import { Response } from 'express';
import { AuthRequest } from '../../types';
import InsumoCategoria from '../models/InsumoCategoria';
import Insumo from '../models/Insumo';
import { normalizeMeasurementUnit } from '../../utils/measurementUnits';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function getInsumosAgrupados(req: AuthRequest, res: Response): Promise<void> {
  try {
    const categorias = await InsumoCategoria.find().sort({ orden: 1 });
    const insumos = await Insumo.find({ activo: true }).sort({ orden: 1 });
    const result = categorias.map((cat) => ({
      categoria: cat,
      insumos: insumos.filter((i) => String(i.categoriaId) === String(cat._id)),
    }));
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error al obtener insumos' });
  }
}

export async function getInsumosCatalog(req: AuthRequest, res: Response): Promise<void> {
  try {
    const categorias = await InsumoCategoria.find().sort({ orden: 1 });
    const insumos = await Insumo.find().sort({ orden: 1 });
    const result = categorias.map((cat) => ({
      categoria: cat,
      insumos: insumos.filter((i) => String(i.categoriaId) === String(cat._id)),
    }));
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error al obtener catálogo' });
  }
}

export async function getCategorias(req: AuthRequest, res: Response): Promise<void> {
  try {
    const categorias = await InsumoCategoria.find().sort({ orden: 1 });
    res.json(categorias);
  } catch {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
}

export async function createCategoria(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }

    const nombre = String(req.body.nombre ?? '').trim();
    if (!nombre) { res.status(400).json({ error: 'El nombre es requerido' }); return; }

    const exists = await InsumoCategoria.findOne({ nombre: new RegExp(`^${escapeRegex(nombre)}$`, 'i') });
    if (exists) { res.status(409).json({ error: 'La categoría ya existe' }); return; }

    const max = await InsumoCategoria.findOne().sort({ orden: -1 }).select('orden').lean();
    const categoria = await InsumoCategoria.create({
      nombre,
      orden: typeof req.body.orden === 'number' ? req.body.orden : (max?.orden ?? 0) + 1,
    });

    res.status(201).json(categoria);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear categoría', details: String(err) });
  }
}

export async function updateCategoria(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }

    const update: Partial<{ nombre: string; orden: number }> = {};
    if (req.body.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim();
      if (!nombre) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
      const exists = await InsumoCategoria.findOne({
        _id: { $ne: req.params.id },
        nombre: new RegExp(`^${escapeRegex(nombre)}$`, 'i'),
      });
      if (exists) { res.status(409).json({ error: 'La categoría ya existe' }); return; }
      update.nombre = nombre;
    }
    if (typeof req.body.orden === 'number') update.orden = req.body.orden;

    const categoria = await InsumoCategoria.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!categoria) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }
    res.json(categoria);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar categoría', details: String(err) });
  }
}

export async function deleteCategoria(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }

    const count = await Insumo.countDocuments({ categoriaId: req.params.id });
    if (count > 0) {
      res.status(409).json({ error: 'No se puede eliminar una categoría con insumos', count });
      return;
    }

    const categoria = await InsumoCategoria.findByIdAndDelete(req.params.id);
    if (!categoria) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }
    res.json({ message: 'Categoría eliminada' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
}

export async function createInsumo(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }
    if (!req.body.categoriaId) { res.status(400).json({ error: 'La categoría es requerida' }); return; }

    const categoria = await InsumoCategoria.findById(req.body.categoriaId);
    if (!categoria) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }

    const max = await Insumo.findOne({ categoriaId: req.body.categoriaId }).sort({ orden: -1 }).select('orden').lean();
    const insumo = await Insumo.create({
      ...req.body,
      unidad: normalizeMeasurementUnit(req.body.unidad),
      cantidadPresentacion: req.body.cantidadPresentacion ?? 1,
      orden: typeof req.body.orden === 'number' ? req.body.orden : (max?.orden ?? 0) + 1,
    });
    res.status(201).json(insumo);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear insumo', details: String(err) });
  }
}

export async function updateInsumo(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }
    const data = { ...req.body };
    if (data.unidad !== undefined) data.unidad = normalizeMeasurementUnit(data.unidad);
    const insumo = await Insumo.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!insumo) { res.status(404).json({ error: 'Insumo no encontrado' }); return; }
    res.json(insumo);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar insumo', details: String(err) });
  }
}

export async function bulkUpdateInsumos(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }
    const updates = req.body.updates as Array<{ id: string; data: Record<string, unknown> }>;
    await Promise.all(updates.map(({ id, data }) => Insumo.findByIdAndUpdate(id, data)));
    res.json({ updated: updates.length });
  } catch (err) {
    res.status(500).json({ error: 'Error en bulk update', details: String(err) });
  }
}

export async function deleteInsumo(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }
    await Insumo.findByIdAndUpdate(req.params.id, { activo: false });
    res.json({ message: 'Insumo desactivado' });
  } catch {
    res.status(500).json({ error: 'Error al desactivar insumo' });
  }
}

export async function reactivarInsumo(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }
    const insumo = await Insumo.findByIdAndUpdate(req.params.id, { activo: true }, { new: true });
    if (!insumo) { res.status(404).json({ error: 'Insumo no encontrado' }); return; }
    res.json(insumo);
  } catch {
    res.status(500).json({ error: 'Error al reactivar insumo' });
  }
}

export async function importCsv(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }
    const rows = req.body.rows as Array<{
      nombre: string; categoria: string; unidad?: string; cantidadPresentacion?: number;
      nivelBueno?: string; nivelRegular?: string; nivelAgotado?: string; precioLista?: number;
    }>;
    const categorias = await InsumoCategoria.find();
    const catMap = Object.fromEntries(categorias.map((c) => [c.nombre.toUpperCase(), c._id]));
    let created = 0; let skipped = 0;
    for (const row of rows) {
      const catId = catMap[row.categoria?.toUpperCase()];
      if (!catId) { skipped++; continue; }
      const maxOrden = await Insumo.countDocuments({ categoriaId: catId });
      await Insumo.findOneAndUpdate(
        { nombre: row.nombre.trim(), categoriaId: catId },
        { $setOnInsert: { orden: maxOrden + 1 }, $set: { unidad: normalizeMeasurementUnit(row.unidad), cantidadPresentacion: row.cantidadPresentacion ?? 1, nivelBueno: row.nivelBueno ?? null, nivelRegular: row.nivelRegular ?? null, nivelAgotado: row.nivelAgotado ?? null, precioLista: row.precioLista ?? null } },
        { upsert: true }
      );
      created++;
    }
    res.json({ created, skipped });
  } catch (err) {
    res.status(500).json({ error: 'Error al importar CSV', details: String(err) });
  }
}
