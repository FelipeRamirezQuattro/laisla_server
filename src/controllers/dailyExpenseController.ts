import mongoose from 'mongoose';
import { Request, Response } from 'express';
import DailyExpense from '../models/DailyExpense';
import Insumo from '../inventario/models/Insumo';
import InsumoStockMovement from '../inventario/models/InsumoStockMovement';
import Provider from '../models/Provider';
import { AuthRequest } from '../types';
import { normalizeMeasurementUnit, toBaseQuantity } from '../utils/measurementUnits';
import { localEndOfDay, localStartOfDay, parseLocalDateInput } from '../utils/timezone';

function dayRange(date?: string) {
  const target = parseLocalDateInput(date);
  return { start: localStartOfDay(target), end: localEndOfDay(target) };
}

function buildFilter(query: Record<string, string | undefined>) {
  const filter: Record<string, unknown> = {};
  if (query.date) {
    const { start, end } = dayRange(query.date);
    filter.date = { $gte: start, $lte: end };
  } else if (query.dateFrom || query.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (query.dateFrom) dateFilter.$gte = localStartOfDay(parseLocalDateInput(query.dateFrom));
    if (query.dateTo) dateFilter.$lte = localEndOfDay(parseLocalDateInput(query.dateTo));
    filter.date = dateFilter;
  }
  if (query.type) filter.type = query.type;
  return filter;
}

export async function getDailyExpenses(req: Request, res: Response): Promise<void> {
  try {
    const filter = buildFilter(req.query as Record<string, string | undefined>);
    const expenses = await DailyExpense.find(filter)
      .populate('insumoId', 'nombre unidad')
      .populate('providerId', 'name')
      .populate('createdBy', 'name')
      .sort({ date: -1, createdAt: -1 })
      .limit(200);
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    res.json({ expenses, total });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener gastos', details: String(err) });
  }
}

export async function createDailyExpense(req: AuthRequest, res: Response): Promise<void> {
  try {
    const type = req.body.type === 'INSUMO' ? 'INSUMO' : 'OTRO';
    const amount = Number(req.body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('El valor del gasto debe ser mayor a cero');
    }

    const date = parseLocalDateInput(req.body.date);
    let description = String(req.body.description ?? '').trim();
    let stockMovementId: mongoose.Types.ObjectId | undefined;
    let expenseUnit = req.body.unit ? normalizeMeasurementUnit(req.body.unit) : undefined;

    if (type === 'INSUMO') {
      const insumo = await Insumo.findById(req.body.insumoId);
      if (!insumo) throw new Error('Insumo no encontrado');

      const quantity = Number(req.body.quantity ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('La cantidad comprada debe ser mayor a cero');
      }

      const unit = normalizeMeasurementUnit(req.body.unit ?? insumo.unidad);
      expenseUnit = unit;
      const providerId = req.body.providerId || null;
      if (providerId) {
        const provider = await Provider.findById(providerId).lean();
        if (!provider) throw new Error('Proveedor no encontrado');
        const providerObjectId = new mongoose.Types.ObjectId(providerId);
        insumo.proveedorPrincipalId = providerObjectId;
        if (!insumo.proveedorIds.some((id) => String(id) === providerId)) {
          insumo.proveedorIds.push(providerObjectId);
        }
        await insumo.save();
      }

      description = description || `Compra de ${insumo.nombre}`;
      const movement = await InsumoStockMovement.create({
        insumoId: insumo._id,
        tipo: 'COMPRA',
        estado: 'APROBADO',
        cantidad: quantity,
        unidad: unit,
        cantidadBase: toBaseQuantity(quantity, unit),
        fecha: date,
        providerId,
        notas: req.body.notes ?? description,
        creadoPor: req.user!.id,
        aprobadoPor: req.user!.id,
        aprobadoEn: new Date(),
      });
      stockMovementId = movement._id as mongoose.Types.ObjectId;
    } else if (!description) {
      throw new Error('El detalle del gasto es requerido');
    }

    const expense = await DailyExpense.create({
      date,
      type,
      description,
      amount,
      insumoId: type === 'INSUMO' ? req.body.insumoId : null,
      providerId: type === 'INSUMO' ? req.body.providerId || null : null,
      quantity: type === 'INSUMO' ? Number(req.body.quantity) : null,
      unit: type === 'INSUMO' ? expenseUnit : null,
      stockMovementId,
      notes: req.body.notes ?? '',
      createdBy: req.user!.id,
    });

    const populated = await DailyExpense.findById(expense._id)
      .populate('insumoId', 'nombre unidad')
      .populate('providerId', 'name')
      .populate('createdBy', 'name');
    res.status(201).json(populated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear gasto';
    res.status(message.includes('no encontrado') ? 404 : 400).json({ error: message, details: String(err) });
  }
}

export async function updateDailyExpense(req: AuthRequest, res: Response): Promise<void> {
  try {
    const expense = await DailyExpense.findById(req.params.id);
    if (!expense) { res.status(404).json({ error: 'Gasto no encontrado' }); return; }

    const amount = Number(req.body.amount ?? expense.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('El valor del gasto debe ser mayor a cero');
    }

    const date = req.body.date ? parseLocalDateInput(req.body.date) : expense.date;
    const description = String(req.body.description ?? expense.description).trim();
    if (!description) throw new Error('El detalle del gasto es requerido');

    expense.date = date;
    expense.description = description;
    expense.amount = amount;
    expense.notes = req.body.notes ?? expense.notes;

    if (expense.type === 'INSUMO') {
      const quantity = Number(req.body.quantity ?? expense.quantity ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('La cantidad comprada debe ser mayor a cero');
      }

      const insumoId = req.body.insumoId ?? expense.insumoId;
      const insumo = await Insumo.findById(insumoId);
      if (!insumo) throw new Error('Insumo no encontrado');

      const unit = normalizeMeasurementUnit(req.body.unit ?? expense.unit ?? insumo.unidad);
      const providerId = req.body.providerId || null;
      if (providerId) {
        const provider = await Provider.findById(providerId).lean();
        if (!provider) throw new Error('Proveedor no encontrado');
        const providerObjectId = new mongoose.Types.ObjectId(providerId);
        insumo.proveedorPrincipalId = providerObjectId;
        if (!insumo.proveedorIds.some((id) => String(id) === providerId)) {
          insumo.proveedorIds.push(providerObjectId);
        }
        await insumo.save();
      }

      expense.insumoId = new mongoose.Types.ObjectId(String(insumoId));
      expense.providerId = providerId ? new mongoose.Types.ObjectId(providerId) : undefined;
      expense.quantity = quantity;
      expense.unit = unit;

      if (expense.stockMovementId) {
        await InsumoStockMovement.findByIdAndUpdate(expense.stockMovementId, {
          insumoId,
          cantidad: quantity,
          unidad: unit,
          cantidadBase: toBaseQuantity(quantity, unit),
          fecha: date,
          providerId,
          notas: req.body.notes ?? description,
          aprobadoPor: req.user!.id,
          aprobadoEn: new Date(),
        });
      }
    }

    await expense.save();
    const populated = await DailyExpense.findById(expense._id)
      .populate('insumoId', 'nombre unidad')
      .populate('providerId', 'name')
      .populate('createdBy', 'name');
    res.json(populated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar gasto';
    res.status(message.includes('no encontrado') ? 404 : 400).json({ error: message, details: String(err) });
  }
}
