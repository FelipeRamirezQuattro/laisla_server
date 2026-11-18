// Tendencias de venta por día de la semana, hora y fecha. Lógica pura (sin Mongoose): arma la
// respuesta a partir de las filas ya agregadas, para poder probarla directamente.

export const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

export interface HeatRow {
  dow: number; // 1 = lunes … 7 = domingo (ISO)
  hour: number; // 0-23, hora de Colombia
  units: number;
  revenue: number;
}

export interface DailyRow {
  date: string; // 'yyyy-MM-dd' (Colombia)
  units: number;
  revenue: number;
}

const DAY_MS = 86_400_000;
const utc = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

// Todas las fechas 'yyyy-MM-dd' de from a to, ambas incluidas.
export function listDates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = utc(from); t <= utc(to); t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

// Día ISO (1 = lunes … 7 = domingo) de una fecha 'yyyy-MM-dd'.
export function isoDow(ymd: string): number {
  const d = new Date(utc(ymd)).getUTCDay();
  return d === 0 ? 7 : d;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface SalesTrends {
  range: { from: string; to: string; days: number };
  totals: { units: number; revenue: number };
  heatmap: HeatRow[]; // 7 × 24 celdas, con ceros
  byWeekday: Array<{ dow: number; label: string; units: number; revenue: number; occurrences: number; avgUnits: number }>;
  byHour: Array<{ hour: number; units: number; revenue: number; avgUnitsPerDay: number }>;
  daily: DailyRow[]; // un punto por cada día del rango, con ceros
  peaks: {
    cell: { dow: number; label: string; hour: number; units: number } | null;
    weekday: { dow: number; label: string; avgUnits: number } | null;
    hour: { hour: number; units: number } | null;
  };
}

export function buildSalesTrends(input: { from: string; to: string; heat: HeatRow[]; daily: DailyRow[] }): SalesTrends {
  const dates = listDates(input.from, input.to);

  const cell = new Map<string, HeatRow>();
  for (const r of input.heat) {
    const key = `${r.dow}-${r.hour}`;
    const cur = cell.get(key) ?? { dow: r.dow, hour: r.hour, units: 0, revenue: 0 };
    cur.units += r.units;
    cur.revenue += r.revenue;
    cell.set(key, cur);
  }
  const heatmap: HeatRow[] = [];
  for (let dow = 1; dow <= 7; dow++) {
    for (let hour = 0; hour < 24; hour++) heatmap.push(cell.get(`${dow}-${hour}`) ?? { dow, hour, units: 0, revenue: 0 });
  }

  const occurrences = new Array<number>(8).fill(0);
  for (const d of dates) occurrences[isoDow(d)]++;

  const byWeekday = WEEKDAY_LABELS.map((label, i) => {
    const dow = i + 1;
    const rows = heatmap.filter((c) => c.dow === dow);
    const units = rows.reduce((s, c) => s + c.units, 0);
    return {
      dow,
      label,
      units,
      revenue: rows.reduce((s, c) => s + c.revenue, 0),
      occurrences: occurrences[dow],
      avgUnits: occurrences[dow] ? round1(units / occurrences[dow]) : 0,
    };
  });

  const byHour = Array.from({ length: 24 }, (_, hour) => {
    const rows = heatmap.filter((c) => c.hour === hour);
    const units = rows.reduce((s, c) => s + c.units, 0);
    return {
      hour,
      units,
      revenue: rows.reduce((s, c) => s + c.revenue, 0),
      avgUnitsPerDay: dates.length ? round1(units / dates.length) : 0,
    };
  });

  const byDate = new Map(input.daily.map((d) => [d.date, d]));
  const daily = dates.map((date) => byDate.get(date) ?? { date, units: 0, revenue: 0 });

  const totalUnits = heatmap.reduce((s, c) => s + c.units, 0);
  const best = <T>(items: T[], score: (t: T) => number): T | null => {
    let top: T | null = null;
    for (const item of items) if (score(item) > (top ? score(top) : 0)) top = item;
    return top;
  };
  const peakCell = best(heatmap, (c) => c.units);
  const peakWeekday = best(byWeekday, (w) => w.avgUnits);
  const peakHour = best(byHour, (h) => h.units);

  return {
    range: { from: input.from, to: input.to, days: dates.length },
    totals: { units: totalUnits, revenue: heatmap.reduce((s, c) => s + c.revenue, 0) },
    heatmap,
    byWeekday,
    byHour,
    daily,
    peaks: {
      cell: peakCell ? { dow: peakCell.dow, label: WEEKDAY_LABELS[peakCell.dow - 1], hour: peakCell.hour, units: peakCell.units } : null,
      weekday: peakWeekday ? { dow: peakWeekday.dow, label: peakWeekday.label, avgUnits: peakWeekday.avgUnits } : null,
      hour: peakHour ? { hour: peakHour.hour, units: peakHour.units } : null,
    },
  };
}
