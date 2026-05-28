import { Response } from 'express';
import { AuthRequest } from '../../types';
import RevisionInventario from '../models/RevisionInventario';
import RevisionInsumoDetalle from '../models/RevisionInsumoDetalle';
import Insumo from '../models/Insumo';
import InsumoCategoria from '../models/InsumoCategoria';
import User from '../../models/User';
import { localDaysAgo } from '../../utils/timezone';

export async function getFrecuenciaAgotamiento(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dias = parseInt((req.query.dias as string) ?? '30');
    const desde = localDaysAgo(dias);
    const revisiones = await RevisionInventario.find({ fecha: { $gte: desde } });
    const revisionIds = revisiones.map((r) => r._id);
    const detalles = await RevisionInsumoDetalle.find({ revisionId: { $in: revisionIds }, nivel: 'AGOTADO' });
    const counts: Record<string, number> = {};
    for (const d of detalles) counts[String(d.insumoId)] = (counts[String(d.insumoId)] ?? 0) + 1;
    const insumoIds = Object.keys(counts);
    const insumos = await Insumo.find({ _id: { $in: insumoIds } });
    const result = insumos
      .map((i) => ({ insumoId: String(i._id), nombre: i.nombre, agotadoCount: counts[String(i._id)] ?? 0 }))
      .sort((a, b) => b.agotadoCount - a.agotadoCount)
      .slice(0, 15);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error al obtener frecuencia' });
  }
}

export async function getCumplimiento(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dias = parseInt((req.query.dias as string) ?? '30');
    const desde = localDaysAgo(dias);
    const revisiones = await RevisionInventario.find({ fecha: { $gte: desde } }).populate('colaboradorId', 'name');
    const byColab: Record<string, { nombre: string; completadas: number; dias: Set<string> }> = {};
    for (const r of revisiones) {
      const uid = String(r.colaboradorId);
      const user = r.colaboradorId as unknown as { name: string };
      if (!byColab[uid]) byColab[uid] = { nombre: user?.name ?? uid, completadas: 0, dias: new Set() };
      if (r.cerradaEn) byColab[uid].completadas++;
      byColab[uid].dias.add(r.fecha.toISOString().split('T')[0]);
    }
    const result = Object.entries(byColab).map(([colaboradorId, v]) => ({
      colaboradorId,
      nombre: v.nombre,
      completadas: v.completadas,
      esperadas: v.dias.size * 2,
      pct: v.dias.size > 0 ? Math.round((v.completadas / (v.dias.size * 2)) * 100) : 0,
    }));
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error al obtener cumplimiento' });
  }
}

export async function getInsumosCriticos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dias = parseInt((req.query.dias as string) ?? '30');
    const desde = localDaysAgo(dias);
    const revisiones = await RevisionInventario.find({ fecha: { $gte: desde } });
    const revisionIds = revisiones.map((r) => r._id);
    const detalles = await RevisionInsumoDetalle.find({ revisionId: { $in: revisionIds }, nivel: 'AGOTADO' });
    const counts: Record<string, number> = {};
    for (const d of detalles) counts[String(d.insumoId)] = (counts[String(d.insumoId)] ?? 0) + 1;
    const top10Ids = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
    const insumos = await Insumo.find({ _id: { $in: top10Ids } }).populate('categoriaId', 'nombre');
    const categorias = await InsumoCategoria.find();
    const catMap = Object.fromEntries(categorias.map((c) => [String(c._id), c.nombre]));
    const result = top10Ids.map((id) => {
      const i = insumos.find((x) => String(x._id) === id);
      return { insumoId: id, nombre: i?.nombre ?? id, categoria: catMap[String(i?.categoriaId)] ?? '', agotadoCount: counts[id] };
    });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error al obtener insumos críticos' });
  }
}

export async function getHoraPromedio(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dias = parseInt((req.query.dias as string) ?? '30');
    const desde = localDaysAgo(dias);
    const revisiones = await RevisionInventario.find({ fecha: { $gte: desde } });
    const byTurno: Record<string, number[]> = { MATUTINO: [], VESPERTINO: [] };
    for (const r of revisiones) {
      const h = r.creadaEn.getHours() + r.creadaEn.getMinutes() / 60;
      byTurno[r.turno]?.push(h);
    }
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const fmt = (h: number | null) => {
      if (h === null) return null;
      const hh = Math.floor(h);
      const mm = Math.round((h - hh) * 60);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };
    res.json({
      matutino: fmt(avg(byTurno.MATUTINO)),
      vespertino: fmt(avg(byTurno.VESPERTINO)),
      counts: { matutino: byTurno.MATUTINO.length, vespertino: byTurno.VESPERTINO.length },
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener horas promedio' });
  }
}
