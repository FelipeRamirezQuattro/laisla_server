// Mongoose orchestration for CashShift lifecycle — mirrors FiscalDocumentService/
// PrintJobService: the decision/arithmetic logic above this file is pure and
// unit-tested; this layer wires it to the DB and is exercised through the
// controller/route tests instead.
import mongoose from 'mongoose';
import CashShift, { ICashShift, ICashShiftAuditEntry, IDenominationCount } from '../models/CashShift';
import CashMovement from '../models/CashMovement';
import DailyExpense from '../../models/DailyExpense';
import Order from '../../models/Order';
import FiscalDocument from '../../fiscal/models/FiscalDocument';
import { getBilledOrderMatch } from '../../utils/orderQueries';
import { localNow } from '../../utils/timezone';
import { DEFAULT_DIFFERENCE_THRESHOLDS } from '../constants/denominations';
import {
  computeDifference,
  computeExpectedCash,
  requiresApproval,
  requiresJustification,
  sumDenominations,
  summarizeSalesByPaymentMethod,
} from './CashShiftService';

export class CashShiftError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function toDenominationCounts(
  input: { value: number; kind: 'bill' | 'coin'; quantity: number }[]
): IDenominationCount[] {
  return input.map((d) => ({ value: d.value, kind: d.kind, quantity: d.quantity, subtotal: d.value * d.quantity }));
}

function pushAudit(shift: ICashShift, entry: { action: ICashShiftAuditEntry['action']; by: string; detail?: Record<string, unknown> }) {
  shift.auditLog.push({ ...entry, by: toObjectId(entry.by), at: localNow() } as ICashShiftAuditEntry);
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

// shift.openedBy may be a bare ObjectId or a populated User doc depending on
// the query that loaded it — this handles both so ownership checks are safe
// either way.
function extractOwnerId(value: unknown): string {
  if (value && typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)._id);
  }
  return String(value);
}

export async function getOpenShift(): Promise<ICashShift | null> {
  return CashShift.findOne({ status: 'OPEN' }).populate('openedBy', 'name');
}

export async function openShift(params: {
  userId: string;
  denominations: { value: number; kind: 'bill' | 'coin'; quantity: number }[];
  notes?: string;
}): Promise<ICashShift> {
  const existing = await CashShift.findOne({ status: 'OPEN' });
  if (existing) {
    throw new CashShiftError('Ya hay un turno abierto. Cierra el turno actual antes de abrir uno nuevo.', 409);
  }

  const now = localNow();
  const denominations = toDenominationCounts(params.denominations);
  const total = sumDenominations(denominations);

  try {
    const shift = await CashShift.create({
      status: 'OPEN',
      openedBy: params.userId,
      openedAt: now,
      openingFloat: { denominations, total, countedBy: params.userId, countedAt: now },
      notes: params.notes ?? '',
      auditLog: [{ action: 'OPEN', by: params.userId, at: now }],
    });
    return shift;
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new CashShiftError('Ya hay un turno abierto. Cierra el turno actual antes de abrir uno nuevo.', 409);
    }
    throw err;
  }
}

async function requireOwnedShift(shiftId: string, userId: string, isAdmin: boolean): Promise<ICashShift> {
  const shift = await CashShift.findById(shiftId);
  if (!shift) throw new CashShiftError('Turno no encontrado', 404);
  if (extractOwnerId(shift.openedBy) !== String(userId) && !isAdmin) {
    throw new CashShiftError('No tienes permiso para operar este turno', 403);
  }
  return shift;
}

export async function addMovement(params: {
  shiftId: string;
  userId: string;
  isAdmin: boolean;
  type: 'WITHDRAWAL' | 'CASH_IN';
  amount: number;
  reason: string;
}): Promise<InstanceType<typeof CashMovement>> {
  const shift = await requireOwnedShift(params.shiftId, params.userId, params.isAdmin);
  if (shift.status !== 'OPEN') {
    throw new CashShiftError('Solo se pueden registrar movimientos en un turno abierto', 400);
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new CashShiftError('El monto del movimiento debe ser mayor a cero', 400);
  }
  if (!params.reason?.trim()) {
    throw new CashShiftError('El motivo del movimiento es requerido', 400);
  }

  const movement = await CashMovement.create({
    cashShiftId: shift._id,
    type: params.type,
    amount: params.amount,
    reason: params.reason.trim(),
    createdBy: params.userId,
  });

  if (params.type === 'WITHDRAWAL') {
    shift.totalWithdrawals = (shift.totalWithdrawals ?? 0) + params.amount;
  } else {
    shift.totalCashIn = (shift.totalCashIn ?? 0) + params.amount;
  }
  await shift.save();

  return movement;
}

export async function getShiftBillingSummary(shift: Pick<ICashShift, '_id' | 'openedAt' | 'closedAt'>) {
  const end = shift.closedAt ?? localNow();

  const [billedOrders, unassignedOrders, dailyExpenses] = await Promise.all([
    Order.find({ ...getBilledOrderMatch(), cashShiftId: shift._id }).lean(),
    Order.find({ ...getBilledOrderMatch({ start: shift.openedAt, end }), cashShiftId: null }).lean(),
    DailyExpense.find({ cashShiftId: shift._id }).lean(),
  ]);

  const sales = summarizeSalesByPaymentMethod(billedOrders);
  const totalExpenses = dailyExpenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    salesSnapshot: { ...sales, unassignedOrdersCount: unassignedOrders.length },
    totalExpenses,
    dailyExpenses,
    unassignedOrders,
  };
}

export async function checkFiscalStatus(shift: Pick<ICashShift, '_id'>): Promise<{ unsettledCount: number; warning: string }> {
  const orderIds = await Order.find({ cashShiftId: shift._id }).distinct('_id');
  if (orderIds.length === 0) return { unsettledCount: 0, warning: '' };

  const unsettledCount = await FiscalDocument.countDocuments({
    orderId: { $in: orderIds },
    type: { $in: ['DEE_POS', 'INVOICE'] },
    status: { $in: ['PENDING', 'SENDING', 'REJECTED', 'ERROR'] },
  });

  return {
    unsettledCount,
    warning: unsettledCount > 0 ? `${unsettledCount} pedido(s) de este turno sin documento fiscal aceptado` : '',
  };
}

export async function submitClosingCount(params: {
  shiftId: string;
  userId: string;
  isAdmin: boolean;
  denominations: { value: number; kind: 'bill' | 'coin'; quantity: number }[];
  notes?: string;
}): Promise<ICashShift> {
  const shift = await requireOwnedShift(params.shiftId, params.userId, params.isAdmin);
  if (shift.status !== 'OPEN') {
    throw new CashShiftError('El turno ya no está abierto', 400);
  }

  const now = localNow();
  const { salesSnapshot, totalExpenses } = await getShiftBillingSummary({
    _id: shift._id,
    openedAt: shift.openedAt,
    closedAt: now,
  });

  const denominations = toDenominationCounts(params.denominations);
  const closingTotal = sumDenominations(denominations);
  const expectedCash = computeExpectedCash({
    openingFloatTotal: shift.openingFloat.total,
    cashSales: salesSnapshot.cashSales,
    totalCashIn: shift.totalCashIn ?? 0,
    totalWithdrawals: shift.totalWithdrawals ?? 0,
    totalExpenses,
  });
  const difference = computeDifference(closingTotal, expectedCash);
  const needsJustification = requiresJustification(difference, DEFAULT_DIFFERENCE_THRESHOLDS);
  const needsApproval = requiresApproval(difference, DEFAULT_DIFFERENCE_THRESHOLDS);

  // "Si superan un umbral configurable, el cierre exige justificación escrita."
  // Enforced here, not just in the UI, so a direct API call can't skip it.
  if (needsJustification && !params.notes?.trim()) {
    throw new CashShiftError(
      'La diferencia supera el umbral permitido — debes justificarla por escrito en las notas antes de cerrar el turno.',
      400
    );
  }

  const { warning: fiscalWarning } = await checkFiscalStatus(shift);

  shift.closingCount = { denominations, total: closingTotal, countedBy: toObjectId(params.userId), countedAt: now };
  shift.closedBy = toObjectId(params.userId);
  shift.closedAt = now;
  shift.salesSnapshot = salesSnapshot;
  shift.totalExpenses = totalExpenses;
  shift.expectedCash = expectedCash;
  shift.difference = difference;
  shift.fiscalWarning = fiscalWarning;
  shift.notes = params.notes ?? shift.notes;
  // Only a difference beyond the approval threshold needs an admin's sign-off —
  // everything else closes straight through to REVIEWED with no manual step.
  shift.status = needsApproval ? 'CLOSED' : 'REVIEWED';
  pushAudit(shift, { action: 'COUNT_CLOSING', by: params.userId, detail: { total: closingTotal } });
  pushAudit(shift, { action: 'CLOSE', by: params.userId, detail: { expectedCash, difference, needsJustification, needsApproval } });

  await shift.save();
  await DailyExpense.updateMany(
    { cashShiftId: shift._id },
    { $set: { locked: true, lockedAt: now } }
  );

  return shift;
}

export async function approveShift(params: { shiftId: string; userId: string; notes?: string }): Promise<ICashShift> {
  const shift = await CashShift.findById(params.shiftId);
  if (!shift) throw new CashShiftError('Turno no encontrado', 404);
  if (shift.status !== 'CLOSED') {
    throw new CashShiftError('Solo se puede aprobar un turno que ya esté cerrado', 400);
  }

  shift.status = 'REVIEWED';
  shift.reviewedBy = toObjectId(params.userId);
  shift.reviewedAt = localNow();
  shift.reviewNotes = params.notes ?? '';
  pushAudit(shift, { action: 'APPROVE', by: params.userId, detail: { notes: params.notes } });
  await shift.save();
  return shift;
}

export async function adjustClosedShift(params: {
  shiftId: string;
  userId: string;
  reason: string;
  changes: Partial<Pick<ICashShift, 'expectedCash' | 'difference' | 'notes'>>;
}): Promise<ICashShift> {
  const shift = await CashShift.findById(params.shiftId);
  if (!shift) throw new CashShiftError('Turno no encontrado', 404);
  if (shift.status !== 'CLOSED' && shift.status !== 'REVIEWED') {
    throw new CashShiftError('Solo se puede ajustar un turno ya cerrado', 400);
  }
  if (!params.reason?.trim()) {
    throw new CashShiftError('El motivo del ajuste es requerido', 400);
  }

  const before = { expectedCash: shift.expectedCash, difference: shift.difference, notes: shift.notes };
  Object.assign(shift, params.changes);
  pushAudit(shift, {
    action: 'ADJUSTMENT',
    by: params.userId,
    detail: { reason: params.reason, before, after: params.changes },
  });
  await shift.save();
  return shift;
}

export async function listShifts(params: {
  userId: string;
  isAdmin: boolean;
  filterUserId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const filter: Record<string, unknown> = {};
  if (!params.isAdmin) {
    filter.openedBy = params.userId;
  } else if (params.filterUserId) {
    filter.openedBy = params.filterUserId;
  }
  if (params.status) filter.status = params.status;
  if (params.dateFrom || params.dateTo) {
    const range: Record<string, Date> = {};
    if (params.dateFrom) range.$gte = params.dateFrom;
    if (params.dateTo) range.$lte = params.dateTo;
    filter.openedAt = range;
  }

  return CashShift.find(filter)
    .populate('openedBy', 'name')
    .populate('closedBy', 'name')
    .populate('reviewedBy', 'name')
    .sort({ openedAt: -1 })
    .limit(100);
}

export async function getShiftById(shiftId: string, userId: string, isAdmin: boolean): Promise<ICashShift> {
  const shift = await CashShift.findById(shiftId)
    .populate('openedBy', 'name')
    .populate('closedBy', 'name')
    .populate('reviewedBy', 'name');
  if (!shift) throw new CashShiftError('Turno no encontrado', 404);
  if (extractOwnerId(shift.openedBy) !== String(userId) && !isAdmin) {
    throw new CashShiftError('No tienes permiso para ver este turno', 403);
  }
  return shift;
}
