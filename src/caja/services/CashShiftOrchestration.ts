// Mongoose orchestration for CashShift lifecycle — mirrors FiscalDocumentService/
// PrintJobService: the decision/arithmetic logic above this file is pure and
// unit-tested; this layer wires it to the DB and is exercised through the
// controller/route tests instead.
import mongoose from 'mongoose';
import CashShift, { ICashShift, ICashShiftAuditEntry, IDenominationCount } from '../models/CashShift';
import CashMovement from '../models/CashMovement';
import CashAccountAdjustment, { AdjustableAccount } from '../models/CashAccountAdjustment';
import DailyExpense from '../../models/DailyExpense';
import Order from '../../models/Order';
import FiscalDocument from '../../fiscal/models/FiscalDocument';
import { derivePaymentMethod, getOrderPayments, validatePayments } from '../../utils/orderPayments';
import { getBilledOrderMatch } from '../../utils/orderQueries';
import { localNow } from '../../utils/timezone';
import { DEFAULT_DIFFERENCE_THRESHOLDS } from '../constants/denominations';
import {
  buildClosingDifferenceMessage,
  computeDifference,
  computeExpectedCash,
  requiresApproval,
  requiresJustification,
  sumDenominations,
  computeAccountBalances,
  computeIdleDrawer,
  sumDrawerExpenses,
  summarizeSalesByPaymentMethod,
} from './CashShiftService';

export class CashShiftError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
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
  // Only cash paid out of the drawer affects the shift's expected cash.
  const totalExpenses = sumDrawerExpenses(dailyExpenses);

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
    const { message, details } = buildClosingDifferenceMessage({
      openingFloatTotal: shift.openingFloat.total,
      cashSales: salesSnapshot.cashSales,
      totalCashIn: shift.totalCashIn ?? 0,
      totalWithdrawals: shift.totalWithdrawals ?? 0,
      totalExpenses,
      counted: closingTotal,
      thresholds: DEFAULT_DIFFERENCE_THRESHOLDS,
    });
    throw new CashShiftError(message, 400, details);
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

// ---- Admin maintenance: reassign orders, edit and delete shifts ----

// A closed shift freezes its sales/expected cash at close time; once an order
// moves in or out those frozen numbers must be re-derived from the orders.
async function refreshClosedShiftSnapshot(shiftId: unknown): Promise<void> {
  const shift = await CashShift.findById(shiftId);
  if (!shift || shift.status === 'OPEN') return;
  const { salesSnapshot, totalExpenses } = await getShiftBillingSummary({
    _id: shift._id,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
  });
  shift.salesSnapshot = salesSnapshot;
  shift.totalExpenses = totalExpenses;
  shift.expectedCash = computeExpectedCash({
    openingFloatTotal: shift.openingFloat.total,
    cashSales: salesSnapshot.cashSales,
    totalCashIn: shift.totalCashIn ?? 0,
    totalWithdrawals: shift.totalWithdrawals ?? 0,
    totalExpenses,
  });
  if (shift.closingCount) shift.difference = computeDifference(shift.closingCount.total, shift.expectedCash);
  await shift.save();
}

export async function assignOrderToShift(params: { orderId: string; shiftId: string | null; userId: string }) {
  const order = await Order.findById(params.orderId);
  if (!order) throw new CashShiftError('Pedido no encontrado', 404);

  let target: ICashShift | null = null;
  if (params.shiftId) {
    target = await CashShift.findById(params.shiftId);
    if (!target) throw new CashShiftError('Turno no encontrado', 404);
  }

  const previousId = order.cashShiftId ? String(order.cashShiftId) : null;
  if (previousId === (params.shiftId ?? null)) return order;

  order.cashShiftId = (target ? target._id : null) as mongoose.Types.ObjectId;
  await order.save();

  if (previousId) {
    const previous = await CashShift.findById(previousId);
    if (previous) {
      pushAudit(previous, { action: 'ORDER_UNASSIGNED', by: params.userId, detail: { orderId: String(order._id), total: order.total, to: params.shiftId } });
      await previous.save();
      await refreshClosedShiftSnapshot(previous._id);
    }
  }
  if (target) {
    pushAudit(target, { action: 'ORDER_ASSIGNED', by: params.userId, detail: { orderId: String(order._id), total: order.total, from: previousId } });
    await target.save();
    await refreshClosedShiftSnapshot(target._id);
  }
  return order;
}

// Corrige el/los métodos de pago de un pedido ya facturado (también con el
// turno cerrado). No toca inventario ni estado; un documento DIAN aceptado ya
// salió con el método original, así que se bloquea en lugar de desincronizarlo.
export async function changeOrderPayments(params: { orderId: string; payments: unknown; userId: string }) {
  const order = await Order.findById(params.orderId);
  if (!order) throw new CashShiftError('Pedido no encontrado', 404);
  if (order.status !== 'billed') throw new CashShiftError('Solo se puede cambiar el pago de un pedido facturado', 400);

  if (order.total === 0) throw new CashShiftError('Un pedido de cortesía (total $0) no tiene pagos que cambiar', 400);

  const validation = validatePayments(params.payments, order.total);
  if (!validation.ok) throw new CashShiftError(validation.error, 400);

  // TODO(provider-docs): con la DIAN activa, definir el flujo para corregir el
  // pago de un pedido con documento ACCEPTED (nota crédito + refacturar, o si
  // el medio de pago permite corrección sin anular). Hoy solo se bloquea.
  const accepted = await FiscalDocument.exists({ orderId: order._id, status: 'ACCEPTED' });
  if (accepted) {
    throw new CashShiftError(
      'El pedido tiene un documento electrónico aceptado por la DIAN. Anule con nota crédito y vuelva a facturar.',
      409
    );
  }

  const before = getOrderPayments(order);
  order.payments = validation.payments;
  order.paymentMethod = derivePaymentMethod(validation.payments) as any;
  order.statusHistory.push({
    status: 'billed',
    at: localNow(),
    by: toObjectId(params.userId),
    notes: `Pago modificado: ${before.map((p) => `${p.method} ${p.amount}`).join(' + ')} → ${validation.payments
      .map((p) => `${p.method} ${p.amount}`)
      .join(' + ')}`,
  } as any);
  await order.save();

  if (order.cashShiftId) {
    const shift = await CashShift.findById(order.cashShiftId);
    if (shift) {
      pushAudit(shift, {
        action: 'PAYMENT_CHANGED',
        by: params.userId,
        detail: { orderId: String(order._id), total: order.total, before, after: validation.payments },
      });
      await shift.save();
      await refreshClosedShiftSnapshot(shift._id);
    }
  }
  return order;
}

export async function updateShiftDetails(params: {
  shiftId: string;
  userId: string;
  openedAt?: Date;
  closedAt?: Date;
  openedBy?: string;
  notes?: string;
}): Promise<ICashShift> {
  const shift = await CashShift.findById(params.shiftId);
  if (!shift) throw new CashShiftError('Turno no encontrado', 404);

  const before = { openedAt: shift.openedAt, closedAt: shift.closedAt, openedBy: shift.openedBy, notes: shift.notes };
  if (params.openedAt) shift.openedAt = params.openedAt;
  if (params.closedAt) {
    if (shift.status === 'OPEN') throw new CashShiftError('No se puede fijar la hora de cierre de un turno abierto', 400);
    shift.closedAt = params.closedAt;
  }
  if (shift.closedAt && shift.openedAt >= shift.closedAt) {
    throw new CashShiftError('La apertura debe ser anterior al cierre', 400);
  }
  if (params.openedBy) shift.openedBy = toObjectId(params.openedBy);
  if (params.notes !== undefined) shift.notes = params.notes;

  pushAudit(shift, {
    action: 'EDIT',
    by: params.userId,
    detail: { before, after: { openedAt: shift.openedAt, closedAt: shift.closedAt, openedBy: shift.openedBy, notes: shift.notes } },
  });
  await shift.save();
  await refreshClosedShiftSnapshot(shift._id);
  return shift;
}

export async function previewShiftDeletion(shiftId: string) {
  const shift = await CashShift.findById(shiftId);
  if (!shift) throw new CashShiftError('Turno no encontrado', 404);
  const orders = await Order.find({ cashShiftId: shift._id }).select('_id total status paymentMethod').lean();
  const orderIds = orders.map((order) => order._id);
  const [expenses, movements, fiscalDocuments] = await Promise.all([
    DailyExpense.find({ cashShiftId: shift._id }).select('amount').lean(),
    CashMovement.countDocuments({ cashShiftId: shift._id }),
    orderIds.length
      ? FiscalDocument.countDocuments({ orderId: { $in: orderIds }, status: { $in: ['ACCEPTED', 'CONTINGENCY'] } })
      : Promise.resolve(0),
  ]);
  return {
    status: shift.status,
    orders: orders.length,
    ordersTotal: orders.reduce((sum, order) => sum + (order.total ?? 0), 0),
    expenses: expenses.length,
    expensesTotal: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    movements,
    acceptedFiscalDocuments: fiscalDocuments,
  };
}

// Cascade delete: the shift and everything attached to it (orders, expenses,
// cash movements). Refuses shifts whose orders already have an accepted fiscal
// document, since those can't be erased from our side. An open shift can be
// deleted too (e.g. one opened by mistake); the till is then left with no shift.
export async function deleteShiftCascade(params: { shiftId: string; userId: string }) {
  const shift = await CashShift.findById(params.shiftId);
  if (!shift) throw new CashShiftError('Turno no encontrado', 404);

  const preview = await previewShiftDeletion(params.shiftId);
  if (preview.acceptedFiscalDocuments > 0) {
    throw new CashShiftError(
      `El turno tiene ${preview.acceptedFiscalDocuments} documento(s) fiscal(es) aceptado(s); reasigna esos pedidos a otro turno antes de eliminarlo`,
      409
    );
  }

  const orderIds = await Order.find({ cashShiftId: shift._id }).distinct('_id');
  await FiscalDocument.deleteMany({ orderId: { $in: orderIds } });
  await Order.deleteMany({ cashShiftId: shift._id });
  await DailyExpense.deleteMany({ cashShiftId: shift._id });
  await CashMovement.deleteMany({ cashShiftId: shift._id });
  await CashShift.deleteOne({ _id: shift._id });

  console.warn('[caja] Turno eliminado en cascada', { shiftId: String(shift._id), by: params.userId, ...preview });
  return preview;
}

// ---- Caja: balances per account, computed on the fly from the full history ----

export async function getCashBalances() {
  const [openShiftDoc, lastClosed, firstShift, allSales, expenses, adjustmentRows] = await Promise.all([
    CashShift.findOne({ status: 'OPEN' }),
    CashShift.findOne({ status: { $in: ['CLOSED', 'REVIEWED'] }, closedAt: { $ne: null } }).sort({ closedAt: -1 }),
    CashShift.findOne().sort({ openedAt: 1 }),
    Order.find(getBilledOrderMatch()).select('total paymentMethod').lean(),
    DailyExpense.find().select('amount paymentMethod cashAccount').lean(),
    CashAccountAdjustment.aggregate<{ _id: AdjustableAccount; total: number }>([
      { $group: { _id: '$account', total: { $sum: '$amount' } } },
    ]),
  ]);
  const adjustments = Object.fromEntries(adjustmentRows.map((row) => [row._id, row.total]));

  let drawer = 0;
  let offShiftExpenses: Array<{ _id: unknown; description: string; amount: number; paymentMethod?: string; cashAccount?: string; createdAt: Date }> = [];

  if (openShiftDoc) {
    const { salesSnapshot, totalExpenses } = await getShiftBillingSummary({
      _id: openShiftDoc._id,
      openedAt: openShiftDoc.openedAt,
      closedAt: undefined,
    });
    drawer = computeExpectedCash({
      openingFloatTotal: openShiftDoc.openingFloat.total,
      cashSales: salesSnapshot.cashSales,
      totalCashIn: openShiftDoc.totalCashIn ?? 0,
      totalWithdrawals: openShiftDoc.totalWithdrawals ?? 0,
      totalExpenses,
    });
  } else if (lastClosed?.closingCount) {
    const since = lastClosed.closedAt as Date;
    const [expensesSince, movementsSince] = await Promise.all([
      DailyExpense.find({ cashShiftId: null, createdAt: { $gt: since } }).sort({ createdAt: -1 }).lean(),
      CashMovement.find({ cashShiftId: null, createdAt: { $gt: since } }).lean(),
    ]);
    offShiftExpenses = expensesSince;
    drawer = computeIdleDrawer({
      lastClosingTotal: lastClosed.closingCount.total,
      offShiftDrawerExpenses: sumDrawerExpenses(expensesSince),
      offShiftCashIn: movementsSince.filter((m) => m.type === 'CASH_IN').reduce((sum, m) => sum + m.amount, 0),
      offShiftWithdrawals: movementsSince.filter((m) => m.type === 'WITHDRAWAL').reduce((sum, m) => sum + m.amount, 0),
    });
  }

  const balances = computeAccountBalances({
    sales: summarizeSalesByPaymentMethod(allSales),
    expenses,
    initialCash: firstShift?.openingFloat?.total ?? 0,
    drawer,
    adjustments,
  });

  return {
    ...balances,
    shiftOpen: !!openShiftDoc,
    // Off-shift expenses made since the last close: shown before the next shift starts.
    pendingOffShiftExpenses: offShiftExpenses,
  };
}

// Till ↔ safe transfer. Inside an open shift it is a regular movement; outside a
// shift it is stored shift-less so it is reflected when the next shift opens.
export async function createTransfer(params: {
  userId: string;
  type: 'WITHDRAWAL' | 'CASH_IN';
  amount: number;
  reason: string;
}) {
  const open = await CashShift.findOne({ status: 'OPEN' }).select('_id');
  if (open) {
    return addMovement({ shiftId: String(open._id), isAdmin: true, ...params });
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new CashShiftError('El monto del movimiento debe ser mayor a cero', 400);
  }
  if (!params.reason?.trim()) {
    throw new CashShiftError('El motivo del movimiento es requerido', 400);
  }
  return CashMovement.create({
    cashShiftId: null,
    type: params.type,
    amount: params.amount,
    reason: params.reason.trim(),
    createdBy: params.userId,
  });
}

export type CashAccountKey = 'menor' | AdjustableAccount;
const ACCOUNT_KEYS: CashAccountKey[] = ['menor', 'general', 'transfer', 'nequi', 'card'];

function assertAmountAndReason(amount: number, reason: string) {
  if (!Number.isFinite(amount) || amount <= 0) throw new CashShiftError('El monto debe ser mayor a cero', 400);
  if (!reason?.trim()) throw new CashShiftError('El motivo es requerido', 400);
}

// Sets an account's computed balance to a counted value by recording the difference.
// The till drawer (caja menor) can't be adjusted: it comes from the shift counts.
export async function calibrateAccount(params: {
  userId: string;
  account: CashAccountKey;
  targetBalance: number;
  reason: string;
}) {
  if (params.account === 'menor') {
    throw new CashShiftError('La caja menor sale del conteo de los turnos; ajústala contando el cierre', 400);
  }
  if (!ACCOUNT_KEYS.includes(params.account)) throw new CashShiftError('Cuenta inválida', 400);
  if (!Number.isFinite(params.targetBalance)) throw new CashShiftError('Saldo inválido', 400);
  if (!params.reason?.trim()) throw new CashShiftError('El motivo es requerido', 400);

  const balances = await getCashBalances();
  const current = params.account === 'general' ? balances.cash.general : balances[params.account];
  const delta = params.targetBalance - current;
  if (delta === 0) return { delta: 0, balances };

  await CashAccountAdjustment.create({
    account: params.account,
    amount: delta,
    kind: 'ADJUSTMENT',
    reason: params.reason.trim(),
    createdBy: params.userId,
  });
  return { delta, balances: await getCashBalances() };
}

// Moves money between any two accounts, using caja general as the hub:
// till drawer ↔ general are real till movements; the other accounts are signed adjustments.
export async function transferBetweenAccounts(params: {
  userId: string;
  from: CashAccountKey;
  to: CashAccountKey;
  amount: number;
  reason: string;
}) {
  if (!ACCOUNT_KEYS.includes(params.from) || !ACCOUNT_KEYS.includes(params.to)) throw new CashShiftError('Cuenta inválida', 400);
  if (params.from === params.to) throw new CashShiftError('El origen y el destino deben ser distintos', 400);
  assertAmountAndReason(params.amount, params.reason);

  const reason = params.reason.trim();
  const groupId = new mongoose.Types.ObjectId().toString();
  const adjust = (account: AdjustableAccount, amount: number) =>
    CashAccountAdjustment.create({ account, amount, kind: 'TRANSFER', reason, groupId, createdBy: params.userId });

  if (params.from === 'menor') {
    await createTransfer({ userId: params.userId, type: 'WITHDRAWAL', amount: params.amount, reason });
  } else if (params.from !== 'general') {
    await adjust(params.from, -params.amount);
    await adjust('general', params.amount);
  }

  if (params.to === 'menor') {
    await createTransfer({ userId: params.userId, type: 'CASH_IN', amount: params.amount, reason });
  } else if (params.to !== 'general') {
    await adjust('general', -params.amount);
    await adjust(params.to, params.amount);
  }

  return getCashBalances();
}
