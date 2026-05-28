import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../../types';
import RevisionInventario from '../models/RevisionInventario';
import RevisionInsumoDetalle from '../models/RevisionInsumoDetalle';
import Insumo from '../models/Insumo';
import { normalizeMeasurementUnit } from '../../utils/measurementUnits';
import { localStartOfDay, localEndOfDay } from '../../utils/timezone';

async function ensureRevisionDetalles(revisionId: mongoose.Types.ObjectId | string) {
  const [insumos, existing] = await Promise.all([
    Insumo.find({ activo: true }).sort({ categoriaId: 1, orden: 1 }),
    RevisionInsumoDetalle.find({ revisionId }).select('insumoId'),
  ]);
  const existingIds = new Set(existing.map((detalle) => String(detalle.insumoId)));
  const missing = insumos.filter((insumo) => !existingIds.has(String(insumo._id)));
  if (missing.length > 0) {
    await RevisionInsumoDetalle.insertMany(
      missing.map((ins) => ({
        revisionId,
        insumoId: ins._id,
        nombreSnapshot: ins.nombre,
        nivel: 'NO_REVISADO',
        unidadObservada: ins.unidad,
      }))
    );
  }
  return RevisionInsumoDetalle.find({ revisionId });
}

export async function createOrGetRevision(req: AuthRequest, res: Response): Promise<void> {
  try {
    const colaboradorId = req.user!.id;
    const { turno, notas } = req.body as { turno: 'MATUTINO' | 'VESPERTINO'; notas?: string };
    const fecha = localStartOfDay();

    const existing = await RevisionInventario.findOne({ fecha, turno, colaboradorId });
    if (existing) {
      const detalles = await ensureRevisionDetalles(existing._id as mongoose.Types.ObjectId);
      res.json({ revision: existing, detalles });
      return;
    }

    const revision = await RevisionInventario.create({ fecha, turno, colaboradorId, notas: notas ?? '' });
    const insumos = await Insumo.find({ activo: true }).sort({ categoriaId: 1, orden: 1 });
    const detalles = await RevisionInsumoDetalle.insertMany(
      insumos.map((ins) => ({
        revisionId: revision._id,
        insumoId: ins._id,
        nombreSnapshot: ins.nombre,
        nivel: 'NO_REVISADO',
        unidadObservada: ins.unidad,
      }))
    );
    res.status(201).json({ revision, detalles });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear revisión', details: String(err) });
  }
}

export async function getHoy(req: AuthRequest, res: Response): Promise<void> {
  try {
    const range = { $gte: localStartOfDay(), $lte: localEndOfDay() };
    const [matutino, vespertino] = await Promise.all([
      RevisionInventario.findOne({ fecha: range, turno: 'MATUTINO' }).populate('colaboradorId', 'name').sort({ creadaEn: -1 }),
      RevisionInventario.findOne({ fecha: range, turno: 'VESPERTINO' }).populate('colaboradorId', 'name').sort({ creadaEn: -1 }),
    ]);
    res.json({ matutino: matutino ?? null, vespertino: vespertino ?? null });
  } catch {
    res.status(500).json({ error: 'Error al obtener revisiones de hoy' });
  }
}

export async function getRevisionDetalles(req: AuthRequest, res: Response): Promise<void> {
  try {
    const revision = await RevisionInventario.findById(req.params.id).populate('colaboradorId', 'name');
    if (!revision) { res.status(404).json({ error: 'Revisión no encontrada' }); return; }
    const detalles = await ensureRevisionDetalles(req.params.id);
    res.json({ revision, detalles });
  } catch {
    res.status(500).json({ error: 'Error al obtener revisión' });
  }
}

export async function updateDetalle(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id, insumoId } = req.params;
    const revision = await RevisionInventario.findById(id);
    if (!revision) { res.status(404).json({ error: 'Revisión no encontrada' }); return; }
    if (revision.cerradaEn && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Revisión cerrada' }); return;
    }
    const { nivel, cantidadObservada, unidadObservada, cantidadSistema, unidadSistema, observacion } = req.body;
    const detalle = await RevisionInsumoDetalle.findOneAndUpdate(
      { revisionId: id, insumoId },
      {
        ...(nivel !== undefined && { nivel }),
        ...(cantidadObservada !== undefined && { cantidadObservada }),
        ...(unidadObservada !== undefined && { unidadObservada: normalizeMeasurementUnit(unidadObservada) }),
        ...(cantidadSistema !== undefined && { cantidadSistema }),
        ...(unidadSistema !== undefined && { unidadSistema: normalizeMeasurementUnit(unidadSistema) }),
        ...(observacion !== undefined && { observacion }),
      },
      { new: true }
    );
    if (!detalle) { res.status(404).json({ error: 'Detalle no encontrado' }); return; }
    res.json(detalle);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar detalle', details: String(err) });
  }
}

export async function bulkUpdateDetalles(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const revision = await RevisionInventario.findById(id);
    if (!revision) { res.status(404).json({ error: 'Revisión no encontrada' }); return; }
    if (revision.cerradaEn && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Revisión cerrada' }); return;
    }
    const updates = req.body.updates as Array<{ insumoId: string; nivel: string }>;
    await Promise.all(
      updates.map(({ insumoId, nivel }) =>
        RevisionInsumoDetalle.findOneAndUpdate({ revisionId: id, insumoId }, { nivel })
      )
    );
    res.json({ updated: updates.length });
  } catch (err) {
    res.status(500).json({ error: 'Error en bulk update', details: String(err) });
  }
}

export async function cerrarRevision(req: AuthRequest, res: Response): Promise<void> {
  try {
    const revision = await RevisionInventario.findById(req.params.id);
    if (!revision) { res.status(404).json({ error: 'Revisión no encontrada' }); return; }
    if (revision.cerradaEn) { res.status(400).json({ error: 'Revisión ya cerrada' }); return; }
    const noRevisados = await RevisionInsumoDetalle.find({ revisionId: revision._id, nivel: 'NO_REVISADO' });
    revision.cerradaEn = new Date();
    await revision.save();
    res.json({ cerrada: true, noRevisados: noRevisados.length, itemNames: noRevisados.map((d) => d.nombreSnapshot) });
  } catch (err) {
    res.status(500).json({ error: 'Error al cerrar revisión', details: String(err) });
  }
}

export async function reabrirRevision(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin puede reabrir' }); return; }
    const revision = await RevisionInventario.findById(req.params.id);
    if (!revision) { res.status(404).json({ error: 'Revisión no encontrada' }); return; }
    revision.cerradaEn = undefined;
    revision.reaperturas.push({
      adminId: new mongoose.Types.ObjectId(req.user!.id),
      reabiertaEn: new Date(),
      motivo: req.body.motivo ?? '',
    });
    await revision.save();
    res.json(revision);
  } catch (err) {
    res.status(500).json({ error: 'Error al reabrir revisión', details: String(err) });
  }
}
