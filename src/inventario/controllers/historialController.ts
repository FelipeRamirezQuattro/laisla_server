import { Response } from 'express';
import { AuthRequest } from '../../types';
import RevisionInventario from '../models/RevisionInventario';
import RevisionInsumoDetalle from '../models/RevisionInsumoDetalle';
import { localStartOfDay, localEndOfDay } from '../../utils/timezone';

export async function getHistorial(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { desde, hasta, turno, colaboradorId, page = '1', limit = '20' } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (desde || hasta) {
      filter.fecha = {};
      if (desde) (filter.fecha as Record<string, unknown>).$gte = localStartOfDay(new Date(desde));
      if (hasta) (filter.fecha as Record<string, unknown>).$lte = localEndOfDay(new Date(hasta));
    }
    if (turno) filter.turno = turno;
    if (colaboradorId) filter.colaboradorId = colaboradorId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [total, revisiones] = await Promise.all([
      RevisionInventario.countDocuments(filter),
      RevisionInventario.find(filter)
        .populate('colaboradorId', 'name')
        .sort({ fecha: -1, turno: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
    ]);

    const revisionIds = revisiones.map((r) => r._id);
    const allDetalles = await RevisionInsumoDetalle.find({ revisionId: { $in: revisionIds } });

    const items = revisiones.map((r) => {
      const detalles = allDetalles.filter((d) => String(d.revisionId) === String(r._id));
      return {
        _id: r._id,
        fecha: r.fecha,
        turno: r.turno,
        colaborador: r.colaboradorId,
        creadaEn: r.creadaEn,
        cerradaEn: r.cerradaEn,
        counts: {
          bueno: detalles.filter((d) => d.nivel === 'BUENO').length,
          regular: detalles.filter((d) => d.nivel === 'REGULAR').length,
          agotado: detalles.filter((d) => d.nivel === 'AGOTADO').length,
          noRevisado: detalles.filter((d) => d.nivel === 'NO_REVISADO').length,
        },
      };
    });

    res.json({ total, page: parseInt(page), limit: parseInt(limit), items });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historial', details: String(err) });
  }
}

export async function getRevisionDetalle(req: AuthRequest, res: Response): Promise<void> {
  try {
    const revision = await RevisionInventario.findById(req.params.revisionId).populate('colaboradorId', 'name');
    if (!revision) { res.status(404).json({ error: 'Revisión no encontrada' }); return; }
    const detalles = await RevisionInsumoDetalle.find({ revisionId: revision._id })
      .populate({ path: 'insumoId', populate: { path: 'categoriaId' } });
    res.json({ revision, detalles });
  } catch {
    res.status(500).json({ error: 'Error al obtener detalle de revisión' });
  }
}
