// Capa Mongoose del vencimiento de insumos; la lógica de decisión está en ExpiryService.ts.
import { formatInTimeZone } from 'date-fns-tz';
import Insumo from '../models/Insumo';
import InsumoStockMovement from '../models/InsumoStockMovement';
import { fromBaseQuantity, normalizeMeasurementUnit } from '../../utils/measurementUnits';
import { localStartOfDay, TZ } from '../../utils/timezone';
import { evaluarLotes, summarizeStock } from './ExpiryService';

export interface VencimientoCreado {
  insumoId: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  movementId: string;
}

const fmt = (d: Date) => formatInTimeZone(d, TZ, 'dd/MM/yyyy');

// Busca lotes vencidos aún sin procesar y, por cada uno con existencia restante, crea un
// movimiento VENCIMIENTO PENDIENTE (hasta que alguien lo apruebe no afecta el stock).
// Es idempotente: cada lote se marca como procesado.
export async function procesarVencimientos(now: Date = new Date()): Promise<VencimientoCreado[]> {
  const hoy = localStartOfDay(now);

  const candidatos = await InsumoStockMovement.find({
    tipo: 'COMPRA',
    estado: 'APROBADO',
    fechaVencimiento: { $ne: null, $lt: hoy },
    vencimientoProcesadoAt: null,
  }).lean();
  if (candidatos.length === 0) return [];

  const insumoIds = [...new Set(candidatos.map((c) => String(c.insumoId)))];
  const creados: VencimientoCreado[] = [];

  for (const insumoId of insumoIds) {
    const insumo = await Insumo.findById(insumoId).select('nombre unidad').lean();
    if (!insumo) continue;

    const desde = candidatos
      .filter((c) => String(c.insumoId) === insumoId)
      .reduce((min, c) => (c.fecha < min ? c.fecha : min), new Date(8.64e15));

    const [movimientos, lotes] = await Promise.all([
      InsumoStockMovement.find({ insumoId, estado: { $in: ['APROBADO', 'PENDIENTE'] } })
        .select('estado cantidadBase')
        .lean(),
      // Solo los lotes que aún cuentan: ya procesados salen de la existencia vía su VENCIMIENTO.
      InsumoStockMovement.find({
        insumoId,
        tipo: 'COMPRA',
        estado: 'APROBADO',
        vencimientoProcesadoAt: null,
        fecha: { $gte: desde },
      }).lean(),
    ]);

    const { stockBase, pendingOutBase } = summarizeStock(movimientos);
    const evaluados = evaluarLotes(
      stockBase - pendingOutBase,
      lotes.map((l) => ({ id: String(l._id), cantidadBase: l.cantidadBase, fecha: l.fecha, fechaVencimiento: l.fechaVencimiento ?? null })),
      hoy
    );

    for (const ev of evaluados.filter((e) => e.vencido)) {
      const lote = lotes.find((l) => String(l._id) === ev.id)!;
      if (ev.remanenteBase > 0) {
        const unidad = normalizeMeasurementUnit(lote.unidad);
        const movimiento = await InsumoStockMovement.create({
          insumoId,
          tipo: 'VENCIMIENTO',
          estado: 'PENDIENTE',
          cantidad: fromBaseQuantity(ev.remanenteBase, unidad),
          unidad,
          cantidadBase: -ev.remanenteBase,
          fecha: now,
          loteId: lote._id,
          notas: `Vencido: lote comprado el ${fmt(lote.fecha)} (vencía el ${fmt(lote.fechaVencimiento as Date)})`,
        });
        creados.push({
          insumoId,
          nombre: insumo.nombre,
          cantidad: movimiento.cantidad,
          unidad,
          movementId: String(movimiento._id),
        });
      }
      await InsumoStockMovement.updateOne({ _id: lote._id }, { $set: { vencimientoProcesadoAt: now } });
    }
  }

  return creados;
}
