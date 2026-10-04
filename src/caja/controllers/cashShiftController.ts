import { Response } from 'express';
import { AuthRequest } from '../../types';
import { isAdminRole } from '../services/CashShiftService';
import {
  CashShiftError,
  addMovement,
  adjustClosedShift,
  approveShift,
  checkFiscalStatus,
  getOpenShift,
  getShiftBillingSummary,
  getShiftById,
  listShifts,
  openShift,
  submitClosingCount,
} from '../services/CashShiftOrchestration';

function handleError(err: unknown, res: Response, fallback: string) {
  if (err instanceof CashShiftError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: fallback, details: String(err) });
}

export async function getOpen(req: AuthRequest, res: Response): Promise<void> {
  try {
    const shift = await getOpenShift();
    res.json(shift);
  } catch (err) {
    handleError(err, res, 'Error al obtener el turno abierto');
  }
}

export async function openNewShift(req: AuthRequest, res: Response): Promise<void> {
  try {
    const shift = await openShift({
      userId: req.user!.id,
      denominations: req.body.denominations ?? [],
      notes: req.body.notes,
    });
    res.status(201).json(shift);
  } catch (err) {
    handleError(err, res, 'Error al abrir el turno');
  }
}

export async function listAll(req: AuthRequest, res: Response): Promise<void> {
  try {
    const isAdmin = isAdminRole(req.user?.role);
    const { status, dateFrom, dateTo, userId } = req.query as Record<string, string | undefined>;
    const shifts = await listShifts({
      userId: req.user!.id,
      isAdmin,
      filterUserId: isAdmin ? userId : undefined,
      status,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
    res.json(shifts);
  } catch (err) {
    handleError(err, res, 'Error al obtener el historial de turnos');
  }
}

export async function getById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const isAdmin = isAdminRole(req.user?.role);
    const shift = await getShiftById(req.params.id, req.user!.id, isAdmin);
    res.json(shift);
  } catch (err) {
    handleError(err, res, 'Error al obtener el turno');
  }
}

export async function getSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const isAdmin = isAdminRole(req.user?.role);
    const shift = await getShiftById(req.params.id, req.user!.id, isAdmin);
    const summary = await getShiftBillingSummary({ _id: shift._id, openedAt: shift.openedAt, closedAt: shift.closedAt });
    res.json(summary);
  } catch (err) {
    handleError(err, res, 'Error al obtener el resumen del turno');
  }
}

export async function getFiscalCheck(req: AuthRequest, res: Response): Promise<void> {
  try {
    const isAdmin = isAdminRole(req.user?.role);
    const shift = await getShiftById(req.params.id, req.user!.id, isAdmin);
    const status = await checkFiscalStatus(shift);
    res.json(status);
  } catch (err) {
    handleError(err, res, 'Error al verificar el estado fiscal del turno');
  }
}

export async function createMovement(req: AuthRequest, res: Response): Promise<void> {
  try {
    const isAdmin = isAdminRole(req.user?.role);
    const movement = await addMovement({
      shiftId: req.params.id,
      userId: req.user!.id,
      isAdmin,
      type: req.body.type,
      amount: Number(req.body.amount),
      reason: req.body.reason,
    });
    res.status(201).json(movement);
  } catch (err) {
    handleError(err, res, 'Error al registrar el movimiento de caja');
  }
}

export async function closeShift(req: AuthRequest, res: Response): Promise<void> {
  try {
    const isAdmin = isAdminRole(req.user?.role);
    const shift = await submitClosingCount({
      shiftId: req.params.id,
      userId: req.user!.id,
      isAdmin,
      denominations: req.body.denominations ?? [],
      notes: req.body.notes,
    });
    res.json(shift);
  } catch (err) {
    handleError(err, res, 'Error al cerrar el turno');
  }
}

export async function approve(req: AuthRequest, res: Response): Promise<void> {
  if (!isAdminRole(req.user?.role)) {
    res.status(403).json({ error: 'Solo un administrador puede aprobar un turno con diferencia' });
    return;
  }
  try {
    const shift = await approveShift({ shiftId: req.params.id, userId: req.user!.id, notes: req.body.notes });
    res.json(shift);
  } catch (err) {
    handleError(err, res, 'Error al aprobar el turno');
  }
}

export async function adjust(req: AuthRequest, res: Response): Promise<void> {
  if (!isAdminRole(req.user?.role)) {
    res.status(403).json({ error: 'Solo un administrador puede ajustar un turno ya cerrado' });
    return;
  }
  try {
    const shift = await adjustClosedShift({
      shiftId: req.params.id,
      userId: req.user!.id,
      reason: req.body.reason,
      changes: req.body.changes ?? {},
    });
    res.json(shift);
  } catch (err) {
    handleError(err, res, 'Error al ajustar el turno');
  }
}
