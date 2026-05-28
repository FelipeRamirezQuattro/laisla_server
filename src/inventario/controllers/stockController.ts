import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../../types';
import Insumo from '../models/Insumo';
import InsumoStockMovement from '../models/InsumoStockMovement';
import Provider from '../../models/Provider';
import { fromBaseQuantity, normalizeMeasurementUnit, toBaseQuantity } from '../../utils/measurementUnits';
import { localStartOfDay, localEndOfDay } from '../../utils/timezone';

function defaultDateRange(query: Record<string, string | undefined>) {
  const hastaDate = query.hasta ? new Date(query.hasta) : new Date();
  const hasta = localEndOfDay(hastaDate);
  const desdeBase = query.desde ? new Date(query.desde) : new Date(hastaDate);
  if (!query.desde) desdeBase.setMonth(desdeBase.getMonth() - 1);
  const desde = localStartOfDay(desdeBase);
  return { desde, hasta };
}

function sumBase(movements: Array<{ cantidadBase: number }>) {
  return movements.reduce((sum, mov) => sum + mov.cantidadBase, 0);
}

export async function getCurrentStock(req: AuthRequest, res: Response): Promise<void> {
  try {
    const insumos = await Insumo.find({ activo: true })
      .populate('categoriaId', 'nombre orden')
      .populate('proveedorPrincipalId', 'name')
      .sort({ categoriaId: 1, orden: 1, nombre: 1 })
      .lean();

    const movements = await InsumoStockMovement.find({
      insumoId: { $in: insumos.map((i) => i._id) },
      estado: { $in: ['APROBADO', 'PENDIENTE'] },
    }).lean();

    const byInsumo = new Map<string, typeof movements>();
    for (const mov of movements) {
      const key = String(mov.insumoId);
      byInsumo.set(key, [...(byInsumo.get(key) ?? []), mov]);
    }

    const result = insumos.map((insumo) => {
      const unit = normalizeMeasurementUnit(insumo.unidad);
      const related = byInsumo.get(String(insumo._id)) ?? [];
      const approved = related.filter((m) => m.estado === 'APROBADO');
      const pending = related.filter((m) => m.estado === 'PENDIENTE');
      const stockBase = sumBase(approved);
      const pendingBase = sumBase(pending);
      const pendingOutBase = Math.abs(sumBase(pending.filter((m) => m.cantidadBase < 0)));
      const pendingInBase = sumBase(pending.filter((m) => m.cantidadBase > 0));
      const lastMovement = related.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())[0];
      return {
        insumo,
        stock: fromBaseQuantity(stockBase, unit),
        pendingDelta: fromBaseQuantity(pendingBase, unit),
        pendingOut: fromBaseQuantity(pendingOutBase, unit),
        pendingIn: fromBaseQuantity(pendingInBase, unit),
        unit,
        pendingCount: pending.length,
        lastMovementAt: lastMovement?.fecha ?? null,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener stock', details: String(err) });
  }
}

export async function getInsumoStockHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { desde, hasta } = defaultDateRange(req.query as Record<string, string | undefined>);
    const insumo = await Insumo.findById(req.params.insumoId)
      .populate('categoriaId', 'nombre')
      .populate('proveedorPrincipalId', 'name')
      .lean();
    if (!insumo) { res.status(404).json({ error: 'Insumo no encontrado' }); return; }

    const movements = await InsumoStockMovement.find({
      insumoId: req.params.insumoId,
      fecha: { $gte: desde, $lte: hasta },
    })
      .populate('providerId', 'name')
      .populate('aprobadoPor', 'name')
      .sort({ fecha: 1, createdAt: 1 })
      .lean();

    const unit = normalizeMeasurementUnit(insumo.unidad);
    const previousApproved = await InsumoStockMovement.find({
      insumoId: req.params.insumoId,
      fecha: { $lt: desde },
      estado: 'APROBADO',
    }).lean();
    let runningBase = sumBase(previousApproved);
    const points = movements
      .filter((m) => m.estado !== 'RECHAZADO')
      .map((m) => {
        if (m.estado === 'APROBADO') runningBase += m.cantidadBase;
        return {
          date: m.fecha,
          stock: fromBaseQuantity(runningBase, unit),
          delta: fromBaseQuantity(m.cantidadBase, unit),
          estado: m.estado,
          tipo: m.tipo,
        };
      });

    res.json({ insumo, desde, hasta, movements, points });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historial de stock', details: String(err) });
  }
}

export async function createPurchase(req: AuthRequest, res: Response): Promise<void> {
  try {
    const insumo = await Insumo.findById(req.params.insumoId);
    if (!insumo) { res.status(404).json({ error: 'Insumo no encontrado' }); return; }

    const cantidad = Number(req.body.cantidad ?? 0);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      res.status(400).json({ error: 'La cantidad debe ser mayor a cero' });
      return;
    }

    const unidad = normalizeMeasurementUnit(req.body.unidad ?? insumo.unidad);
    const providerId = req.body.providerId || null;
    if (providerId) {
      const provider = await Provider.findById(providerId).lean();
      if (!provider) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }
      const providerObjectId = new mongoose.Types.ObjectId(providerId);
      insumo.proveedorPrincipalId = providerObjectId;
      if (!insumo.proveedorIds.some((id) => String(id) === providerId)) {
        insumo.proveedorIds.push(providerObjectId);
      }
      await insumo.save();
    }

    const movement = await InsumoStockMovement.create({
      insumoId: insumo._id,
      tipo: 'COMPRA',
      estado: 'APROBADO',
      cantidad,
      unidad,
      cantidadBase: toBaseQuantity(cantidad, unidad),
      fecha: req.body.fecha ? new Date(req.body.fecha) : new Date(),
      providerId,
      notas: req.body.notas ?? '',
      creadoPor: req.user!.id,
      aprobadoPor: req.user!.id,
      aprobadoEn: new Date(),
    });

    res.status(201).json(movement);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar compra', details: String(err) });
  }
}

export async function approveMovement(req: AuthRequest, res: Response): Promise<void> {
  try {
    const movement = await InsumoStockMovement.findById(req.params.movementId);
    if (!movement) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }
    if (movement.estado !== 'PENDIENTE') { res.status(400).json({ error: 'El movimiento no está pendiente' }); return; }

    if (req.body.cantidad !== undefined || req.body.unidad !== undefined) {
      const cantidad = req.body.cantidad !== undefined ? Number(req.body.cantidad) : movement.cantidad;
      if (!Number.isFinite(cantidad) || cantidad < 0) { res.status(400).json({ error: 'Cantidad inválida' }); return; }
      const unidad = normalizeMeasurementUnit(req.body.unidad ?? movement.unidad);
      const sign = movement.cantidadBase < 0 ? -1 : 1;
      movement.cantidad = cantidad;
      movement.unidad = unidad;
      movement.cantidadBase = sign * toBaseQuantity(cantidad, unidad);
    }

    movement.estado = 'APROBADO';
    movement.aprobadoPor = new mongoose.Types.ObjectId(req.user!.id);
    movement.aprobadoEn = new Date();
    await movement.save();
    res.json(movement);
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar movimiento', details: String(err) });
  }
}

export async function rejectMovement(req: AuthRequest, res: Response): Promise<void> {
  try {
    const movement = await InsumoStockMovement.findById(req.params.movementId);
    if (!movement) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }
    if (movement.estado !== 'PENDIENTE') { res.status(400).json({ error: 'El movimiento no está pendiente' }); return; }
    movement.estado = 'RECHAZADO';
    movement.rechazadoPor = new mongoose.Types.ObjectId(req.user!.id);
    movement.rechazadoEn = new Date();
    movement.notas = req.body.notas ?? movement.notas;
    await movement.save();
    res.json(movement);
  } catch (err) {
    res.status(500).json({ error: 'Error al rechazar movimiento', details: String(err) });
  }
}
