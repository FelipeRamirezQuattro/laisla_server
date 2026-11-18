// Vencimiento de insumos. Lógica pura (sin Mongoose) para poder probarla directamente,
// igual que CashShiftService/CashShiftOrchestration en el módulo de caja.
import { addDays } from 'date-fns';
import { parseLocalDateInput } from '../../utils/timezone';
import type { TipoVencimiento } from '../models/Insumo';

export class ExpiryError extends Error {}

export interface ExpiryConfig {
  tipoVencimiento?: TipoVencimiento | null;
  vidaUtilDias?: number | null;
}

// La fecha de vencimiento es el ÚLTIMO día en que el insumo sirve (a las 00:00 hora Colombia
// de ese día); queda vencido a partir del día siguiente.
//  - NINGUNO: no vence → null.
//  - FECHA: la compra debe traer su fecha de vencimiento.
//  - VIDA_UTIL: fecha de compra + N días, salvo que se indique otra fecha explícita.
export function computeFechaVencimiento(
  config: ExpiryConfig,
  purchaseDate: Date,
  explicit?: string | Date | null
): Date | null {
  const tipo = config.tipoVencimiento ?? 'NINGUNO';
  if (tipo === 'NINGUNO') return null;

  if (explicit) {
    const parsed = explicit instanceof Date ? explicit : parseLocalDateInput(explicit);
    if (Number.isNaN(parsed.getTime())) throw new ExpiryError('La fecha de vencimiento no es válida');
    return parsed;
  }

  if (tipo === 'FECHA') throw new ExpiryError('Indica la fecha de vencimiento de esta compra');

  const dias = config.vidaUtilDias ?? 0;
  if (!(dias >= 1)) throw new ExpiryError('El insumo no tiene días de vida útil configurados');
  return addDays(purchaseDate, dias);
}

// ---- Lotes vencidos (FIFO) ----

export interface Lote {
  id: string;
  /** Cantidad comprada, en unidad base. */
  cantidadBase: number;
  /** Fecha de la compra. */
  fecha: Date;
  fechaVencimiento: Date | null;
}

export interface LoteEvaluado {
  id: string;
  /** Cuánto de este lote se estima que aún está en existencia (unidad base). */
  remanenteBase: number;
  vencido: boolean;
}

// No se rastrea de qué lote sale cada consumo, así que se asume FIFO: se gasta primero lo más
// antiguo, por lo que la existencia actual está formada por los lotes MÁS NUEVOS. Se reparte
// `stockEfectivoBase` de el más nuevo al más antiguo y lo que cae en un lote vencido es lo que
// hay que descontar. Existencia anterior a los lotes (sin lote) nunca se toca.
// `hoy` = inicio del día actual (hora Colombia): vencido = último día útil anterior a hoy.
export function evaluarLotes(stockEfectivoBase: number, lotes: Lote[], hoy: Date): LoteEvaluado[] {
  let restante = Math.max(stockEfectivoBase, 0);
  return [...lotes]
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .map((lote) => {
      const remanenteBase = Math.min(lote.cantidadBase, restante);
      restante -= remanenteBase;
      return {
        id: lote.id,
        remanenteBase,
        vencido: lote.fechaVencimiento !== null && lote.fechaVencimiento.getTime() < hoy.getTime(),
      };
    });
}

export interface StockMovementLite {
  estado: string;
  cantidadBase: number;
}

// Existencia aprobada y salidas pendientes (ventas automáticas / vencimientos aún sin aprobar).
export function summarizeStock(movements: StockMovementLite[]) {
  let stockBase = 0;
  let pendingOutBase = 0;
  for (const m of movements) {
    if (m.estado === 'APROBADO') stockBase += m.cantidadBase;
    else if (m.estado === 'PENDIENTE' && m.cantidadBase < 0) pendingOutBase += -m.cantidadBase;
  }
  return { stockBase, pendingOutBase };
}
