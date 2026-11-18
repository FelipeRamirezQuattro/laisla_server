// Capa Mongoose de las alertas de inventario; las decisiones están en StockAlertService.ts.
import mongoose from 'mongoose';
import Insumo from '../models/Insumo';
import InsumoStockMovement from '../models/InsumoStockMovement';
import { fromBaseQuantity, normalizeMeasurementUnit, toBaseQuantity } from '../../utils/measurementUnits';
import { notifyAllUsers } from '../../services/notificationService';
import { summarizeStock } from './ExpiryService';
import { decideHighUsage, decideStockLow, promedioSemanalPrevio, CONSUMO_ALTO_DIAS_ENTRE_ALERTAS } from './StockAlertService';

const INVENTORY_LINK = '/admin/costos/inventario/stock';
const DAY_MS = 86_400_000;

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);

export interface AlertSummary {
  stockBajo: string[];
  consumoAlto: string[];
}

// Evalúa un insumo (o todos los activos si no se indican ids). Es seguro llamarlo muchas veces:
// cada alerta se dispara una sola vez gracias a la bandera que se activa de forma atómica.
export async function evaluarAlertasInsumos(insumoIds?: string[], now: Date = new Date()): Promise<AlertSummary> {
  const summary: AlertSummary = { stockBajo: [], consumoAlto: [] };
  const filter: Record<string, unknown> = { activo: true };
  if (insumoIds) filter._id = { $in: insumoIds };
  const insumos = await Insumo.find(filter).lean();

  for (const insumo of insumos) {
    const unidad = normalizeMeasurementUnit(insumo.unidad);
    const movimientos = await InsumoStockMovement.find({
      insumoId: insumo._id,
      estado: { $in: ['APROBADO', 'PENDIENTE'] },
    })
      .select('estado cantidadBase tipo fecha')
      .lean();

    // ---- Stock bajo: existencia aprobada menos lo que ya está vendido pero sin aprobar ----
    const { stockBase, pendingOutBase } = summarizeStock(movimientos);
    const efectivoBase = stockBase - pendingOutBase;
    const stockMinimoBase = insumo.stockMinimo != null ? toBaseQuantity(insumo.stockMinimo, unidad) : null;
    const decision = decideStockLow({ stockBase: efectivoBase, stockMinimoBase, alertaActiva: !!insumo.alertaStockBajoActiva });

    if (decision === 'REARMAR') {
      await Insumo.updateOne({ _id: insumo._id }, { $set: { alertaStockBajoActiva: false } });
    } else if (decision === 'ALERTAR') {
      const claimed = await Insumo.findOneAndUpdate(
        { _id: insumo._id, alertaStockBajoActiva: { $ne: true } },
        { $set: { alertaStockBajoActiva: true } }
      );
      if (claimed) {
        await notifyAllUsers({
          type: 'stock_low',
          title: `Se está acabando: ${insumo.nombre}`,
          message: `Quedan ${fmt(fromBaseQuantity(Math.max(efectivoBase, 0), unidad))} ${unidad} (mínimo ${fmt(insumo.stockMinimo as number)} ${unidad}). Conviene reponerlo.`,
          entityType: 'insumo',
          entityId: insumo._id,
          linkTo: INVENTORY_LINK,
        });
        summary.stockBajo.push(insumo.nombre);
      }
    }

    // ---- Consumo alto: ventas de los últimos 7 días vs. promedio de las 4 semanas previas ----
    const corte7 = now.getTime() - 7 * DAY_MS;
    let ultimos7 = 0;
    let previas = 0;
    for (const m of movimientos) {
      if (m.tipo !== 'VENTA_AUTOMATICA' || m.cantidadBase >= 0) continue;
      const t = m.fecha.getTime();
      if (t >= corte7) ultimos7 += -m.cantidadBase;
      else previas += -m.cantidadBase;
    }
    if (decideHighUsage({ consumoUltimos7Base: ultimos7, consumoPrevias4SemBase: previas, ultimaAlertaAt: insumo.ultimaAlertaConsumoAt, now })) {
      const claimed = await Insumo.findOneAndUpdate(
        {
          _id: insumo._id,
          $or: [
            { ultimaAlertaConsumoAt: null },
            { ultimaAlertaConsumoAt: { $lt: new Date(now.getTime() - CONSUMO_ALTO_DIAS_ENTRE_ALERTAS * DAY_MS) } },
          ],
        },
        { $set: { ultimaAlertaConsumoAt: now } }
      );
      if (claimed) {
        await notifyAllUsers({
          type: 'stock_high_usage',
          title: `Consumo alto: ${insumo.nombre}`,
          message: `En los últimos 7 días se usaron ${fmt(fromBaseQuantity(ultimos7, unidad))} ${unidad}; el promedio semanal anterior era ${fmt(fromBaseQuantity(promedioSemanalPrevio(previas), unidad))} ${unidad}.`,
          entityType: 'insumo',
          entityId: insumo._id,
          linkTo: INVENTORY_LINK,
        });
        summary.consumoAlto.push(insumo.nombre);
      }
    }
  }
  return summary;
}

// Tras facturar un pedido: revisa solo los insumos que ese pedido consumió.
export async function evaluarAlertasDePedido(orderId: string | mongoose.Types.ObjectId): Promise<void> {
  const ids = await InsumoStockMovement.find({ orderId, tipo: 'VENTA_AUTOMATICA' }).distinct('insumoId');
  if (ids.length > 0) await evaluarAlertasInsumos(ids.map(String));
}

// Para llamar desde controladores: una falla de alertas nunca debe romper la operación principal.
export function evaluarAlertasSilencioso(insumoIds: string[]): void {
  evaluarAlertasInsumos(insumoIds).catch((err) => console.error('Error evaluando alertas de inventario:', err));
}
