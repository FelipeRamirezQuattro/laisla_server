// Datos del mes anterior para sugerir clientes/mes, productos/cliente y GIF.
// Lógica pura (sin Mongoose), probada directamente; MonthlyBaselineOrchestration la conecta a la base.
import { formatInTimeZone } from 'date-fns-tz';
import { localEndOfDay, localStartOfDay, parseLocalDateInput, TZ } from '../../utils/timezone';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isValidMonth = (value: unknown): value is string => typeof value === 'string' && MONTH_RE.test(value);

// Mes anterior a `now` en hora de Colombia, como 'yyyy-MM'.
export function previousMonth(now: Date): string {
  const [y, m] = formatInTimeZone(now, TZ, 'yyyy-MM').split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

// Primer instante y último instante del mes (hora de Colombia).
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: localStartOfDay(parseLocalDateInput(`${month}-01`)),
    end: localEndOfDay(parseLocalDateInput(`${month}-${String(lastDay).padStart(2, '0')}`)),
  };
}

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export interface CustomerBaseline {
  available: boolean;
  orders: number;
  units: number;
  monthlyCustomers: number;
  productsPerCustomer: number;
}

// "Cliente" = pedido facturado con al menos una unidad vendida (los de solo cortesías no cuentan).
// El esquema de parámetros exige mínimo 1 en ambos valores, por eso se acota.
export function buildCustomerBaseline(input: { orders: number; units: number }): CustomerBaseline {
  if (input.orders <= 0) {
    return { available: false, orders: 0, units: 0, monthlyCustomers: 1, productsPerCustomer: 1 };
  }
  return {
    available: true,
    orders: input.orders,
    units: input.units,
    monthlyCustomers: Math.max(1, input.orders),
    productsPerCustomer: Math.max(1, Math.round((input.units / input.orders) * 100) / 100),
  };
}

export type OverheadStatus = 'PAGADO' | 'SIN_PAGOS' | 'NUEVO';

export interface OverheadSuggestionItem {
  concept: string;
  current: number;
  paid: number;
  status: OverheadStatus;
  /** Valor que se propone como costo mensual del concepto. */
  suggested: number;
}

// Compara sin importar mayúsculas, tildes ni espacios sobrantes ("Energía" == "energia ").
const key = (concept: string) =>
  concept.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Los conceptos con pagos toman lo pagado; los que NO se pagaron ese mes conservan su valor actual
// (un gasto bimestral o anual no debe volver a 0); los conceptos nuevos que aparezcan en los
// gastos se agregan al final.
export function mergeOverheadSuggestion(
  current: Array<{ concept: string; monthlyCost: number }>,
  paidByConcept: Array<{ concept: string; paid: number }>
): { items: OverheadSuggestionItem[]; totalPaid: number; currentTotal: number; suggestedTotal: number } {
  const paid = new Map<string, { concept: string; paid: number }>();
  for (const row of paidByConcept) {
    const k = key(row.concept);
    const prev = paid.get(k);
    paid.set(k, { concept: prev?.concept ?? row.concept.trim(), paid: (prev?.paid ?? 0) + row.paid });
  }

  const items: OverheadSuggestionItem[] = current.map((item) => {
    const hit = paid.get(key(item.concept));
    paid.delete(key(item.concept));
    return hit && hit.paid > 0
      ? { concept: item.concept, current: item.monthlyCost, paid: hit.paid, status: 'PAGADO', suggested: hit.paid }
      : { concept: item.concept, current: item.monthlyCost, paid: 0, status: 'SIN_PAGOS', suggested: item.monthlyCost };
  });

  for (const row of paid.values()) {
    if (row.paid > 0) items.push({ concept: row.concept, current: 0, paid: row.paid, status: 'NUEVO', suggested: row.paid });
  }

  return {
    items,
    totalPaid: items.reduce((s, i) => s + i.paid, 0),
    currentTotal: items.reduce((s, i) => s + i.current, 0),
    suggestedTotal: items.reduce((s, i) => s + i.suggested, 0),
  };
}
