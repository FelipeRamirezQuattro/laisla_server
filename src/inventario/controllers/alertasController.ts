import { Response } from 'express';
import { AuthRequest } from '../../types';
import RevisionInventario from '../models/RevisionInventario';
import RevisionInsumoDetalle from '../models/RevisionInsumoDetalle';
import Insumo from '../models/Insumo';
import InsumoCategoria from '../models/InsumoCategoria';

import { localStartOfDay, localEndOfDay } from '../../utils/timezone';

function todayRange() {
  return { $gte: localStartOfDay(), $lte: localEndOfDay() };
}

export async function getAlertas(req: AuthRequest, res: Response): Promise<void> {
  try {
    const range = todayRange();
    const revisiones = await RevisionInventario.find({ fecha: range, cerradaEn: { $ne: null } }).sort({ cerradaEn: -1 });

    if (!revisiones.length) { res.json([]); return; }

    // Latest closed revision per shift
    const latestByShift: Record<string, string> = {};
    for (const r of revisiones) {
      if (!latestByShift[r.turno]) latestByShift[r.turno] = String(r._id);
    }
    const revisionIds = Object.values(latestByShift);

    const detalles = await RevisionInsumoDetalle.find({
      revisionId: { $in: revisionIds },
      nivel: { $in: ['AGOTADO', 'REGULAR'] },
      compradoEn: null,
    });

    if (!detalles.length) { res.json([]); return; }

    const insumoIds = [...new Set(detalles.map((d) => String(d.insumoId)))];
    const [insumos, categorias] = await Promise.all([
      Insumo.find({ _id: { $in: insumoIds } }),
      InsumoCategoria.find().sort({ orden: 1 }),
    ]);
    const insumoMap = Object.fromEntries(insumos.map((i) => [String(i._id), i]));
    const catMap = Object.fromEntries(categorias.map((c) => [String(c._id), c]));

    const revMap = Object.fromEntries(revisiones.map((r) => [String(r._id), r]));

    const alertas = detalles.map((d) => {
      const insumo = insumoMap[String(d.insumoId)];
      const cat = insumo ? catMap[String(insumo.categoriaId)] : null;
      const rev = revMap[String(d.revisionId)];
      return { detalle: d, insumo, categoria: cat, ultimaRevision: rev?.cerradaEn };
    }).filter((a) => a.insumo && a.categoria);

    // AGOTADO first, then REGULAR
    alertas.sort((a, b) => {
      if (a.detalle.nivel === b.detalle.nivel) return 0;
      return a.detalle.nivel === 'AGOTADO' ? -1 : 1;
    });

    res.json(alertas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener alertas', details: String(err) });
  }
}

export async function marcarComprado(req: AuthRequest, res: Response): Promise<void> {
  try {
    const range = todayRange();
    const revisiones = await RevisionInventario.find({ fecha: range, cerradaEn: { $ne: null } });
    const revisionIds = revisiones.map((r) => r._id);
    const detalle = await RevisionInsumoDetalle.findOneAndUpdate(
      { revisionId: { $in: revisionIds }, insumoId: req.params.insumoId, compradoEn: null },
      { compradoEn: new Date() },
      { new: true }
    );
    if (!detalle) { res.status(404).json({ error: 'Alerta no encontrada' }); return; }
    res.json(detalle);
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar comprado', details: String(err) });
  }
}
