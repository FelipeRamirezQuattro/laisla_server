// Reporte de recetas vendidas por semana. Lógica pura (semanas ISO en hora Colombia y armado de
// la respuesta) separada de la agregación de MongoDB, para poder probarla directamente.
import { addWeeks, format, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { TZ } from './timezone';

export interface WeekDef {
  key: string; // '2026-W46'
  year: number;
  week: number;
  start: string; // lunes de esa semana, 'yyyy-MM-dd'
  partial: boolean; // semana en curso (aún incompleta)
}

const weekKey = (year: number, week: number) => `${year}-W${String(week).padStart(2, '0')}`;

// Las últimas `count` semanas ISO (lunes a domingo, hora de Colombia); la última es la actual.
export function buildWeeks(now: Date, count: number): WeekDef[] {
  const currentStart = startOfISOWeek(toZonedTime(now, TZ));
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    const start = addWeeks(currentStart, -offset);
    const year = getISOWeekYear(start);
    const week = getISOWeek(start);
    return { key: weekKey(year, week), year, week, start: format(start, 'yyyy-MM-dd'), partial: offset === 0 };
  });
}

// Instante real en que empieza la primera semana de la ventana (lunes 00:00 hora Colombia).
export function windowStart(now: Date, count: number): Date {
  const first = addWeeks(startOfISOWeek(toZonedTime(now, TZ)), -(count - 1));
  return fromZonedTime(first, TZ);
}

export interface WeeklyRow {
  recipeId: string | null;
  year: number;
  week: number;
  sold: number;
  complimentary: number;
}

export interface TotalRow {
  recipeId: string | null;
  sold: number;
  complimentary: number;
}

export interface RecipeInfo {
  name: string;
  category?: string;
}

export interface RecipeWeeklyEntry {
  recipeId: string | null;
  name: string;
  category: string | null;
  weekly: Array<{ key: string; sold: number; complimentary: number }>;
  windowSold: number;
  windowComplimentary: number;
  /** Consumo promedio por semana COMPLETA de la ventana (vendidas + cortesías). */
  avgWeekly: number;
  /** Variación % de la última semana completa vs. la anterior; null si no hay base de comparación. */
  trendPct: number | null;
  /** Acumulado histórico hasta hoy. */
  totalSold: number;
  totalComplimentary: number;
}

export function buildWeeklyRecipeReport(
  weeks: WeekDef[],
  rows: WeeklyRow[],
  totals: TotalRow[],
  recipes: Record<string, RecipeInfo>
): RecipeWeeklyEntry[] {
  const keyOf = (id: string | null) => id ?? 'none';
  const ids = new Set<string>([...rows.map((r) => keyOf(r.recipeId)), ...totals.map((t) => keyOf(t.recipeId))]);
  const completed = weeks.filter((w) => !w.partial);

  const entries = [...ids].map((id): RecipeWeeklyEntry => {
    const recipeId = id === 'none' ? null : id;
    const weekly = weeks.map((w) => {
      const match = rows.filter((r) => keyOf(r.recipeId) === id && weekKey(r.year, r.week) === w.key);
      return {
        key: w.key,
        sold: match.reduce((s, r) => s + r.sold, 0),
        complimentary: match.reduce((s, r) => s + r.complimentary, 0),
      };
    });
    const consumed = (key: string) => {
      const w = weekly.find((x) => x.key === key)!;
      return w.sold + w.complimentary;
    };

    const completedTotal = completed.reduce((s, w) => s + consumed(w.key), 0);
    let trendPct: number | null = null;
    if (completed.length >= 2) {
      const last = consumed(completed[completed.length - 1].key);
      const before = consumed(completed[completed.length - 2].key);
      if (before > 0) trendPct = Math.round(((last - before) / before) * 1000) / 10;
    }

    const total = totals.find((t) => keyOf(t.recipeId) === id);
    return {
      recipeId,
      name: recipeId ? recipes[recipeId]?.name ?? 'Receta eliminada' : 'Sin receta',
      category: recipeId ? recipes[recipeId]?.category ?? null : null,
      weekly,
      windowSold: weekly.reduce((s, w) => s + w.sold, 0),
      windowComplimentary: weekly.reduce((s, w) => s + w.complimentary, 0),
      avgWeekly: completed.length ? Math.round((completedTotal / completed.length) * 10) / 10 : 0,
      trendPct,
      totalSold: total?.sold ?? 0,
      totalComplimentary: total?.complimentary ?? 0,
    };
  });

  return entries.sort(
    (a, b) =>
      b.windowSold + b.windowComplimentary - (a.windowSold + a.windowComplimentary) ||
      b.totalSold + b.totalComplimentary - (a.totalSold + a.totalComplimentary)
  );
}
