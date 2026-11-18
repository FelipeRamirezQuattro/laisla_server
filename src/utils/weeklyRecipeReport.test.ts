import { describe, expect, it } from 'vitest';
import { buildWeeklyRecipeReport, buildWeeks, windowStart } from './weeklyRecipeReport';

describe('buildWeeks', () => {
  // miércoles 18-nov-2026 → semana ISO 47 (lunes 16-nov)
  const now = new Date('2026-11-18T15:00:00Z');

  it('devuelve las últimas N semanas ISO terminando en la actual (parcial)', () => {
    const weeks = buildWeeks(now, 3);
    expect(weeks.map((w) => w.key)).toEqual(['2026-W45', '2026-W46', '2026-W47']);
    expect(weeks.map((w) => w.start)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(weeks.map((w) => w.partial)).toEqual([false, false, true]);
  });

  it('cruza el cambio de año ISO', () => {
    const weeks = buildWeeks(new Date('2027-01-06T15:00:00Z'), 3);
    expect(weeks.map((w) => w.key)).toEqual(['2026-W52', '2026-W53', '2027-W01']);
  });

  it('el domingo en la noche (hora Colombia) aún es la semana que termina', () => {
    // domingo 15-nov 23:30 Colombia = lunes 16-nov 04:30 UTC
    const weeks = buildWeeks(new Date('2026-11-16T04:30:00Z'), 1);
    expect(weeks[0].key).toBe('2026-W46');
  });

  it('windowStart es el lunes 00:00 hora Colombia de la primera semana', () => {
    expect(windowStart(now, 3).toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });
});

describe('buildWeeklyRecipeReport', () => {
  const weeks = buildWeeks(new Date('2026-11-18T15:00:00Z'), 3); // W45, W46, W47(parcial)
  const recipes = { a: { name: 'Latte', category: 'Bebidas' }, b: { name: 'Brownie' } };

  it('arma la serie semanal, cero-rellena y ordena por consumo de la ventana', () => {
    const out = buildWeeklyRecipeReport(
      weeks,
      [
        { recipeId: 'a', year: 2026, week: 45, sold: 10, complimentary: 0 },
        { recipeId: 'a', year: 2026, week: 46, sold: 20, complimentary: 2 },
        { recipeId: 'a', year: 2026, week: 47, sold: 5, complimentary: 0 },
        { recipeId: 'b', year: 2026, week: 46, sold: 3, complimentary: 0 },
      ],
      [
        { recipeId: 'a', sold: 100, complimentary: 4 },
        { recipeId: 'b', sold: 30, complimentary: 0 },
      ],
      recipes
    );
    expect(out.map((r) => r.name)).toEqual(['Latte', 'Brownie']);
    const latte = out[0];
    expect(latte.weekly.map((w) => w.sold)).toEqual([10, 20, 5]);
    expect(latte.windowSold).toBe(35);
    expect(latte.windowComplimentary).toBe(2);
    expect(latte.totalSold).toBe(100);
    expect(latte.totalComplimentary).toBe(4);
    // semanas completas W45 (10) y W46 (22) → promedio 16; tendencia (22−10)/10 = +120 %
    expect(latte.avgWeekly).toBe(16);
    expect(latte.trendPct).toBe(120);
    expect(out[1].weekly.map((w) => w.sold)).toEqual([0, 3, 0]);
    expect(out[1].trendPct).toBeNull(); // W45 fue 0: sin base
  });

  it('incluye recetas con ventas históricas pero sin ventas en la ventana', () => {
    const out = buildWeeklyRecipeReport(weeks, [], [{ recipeId: 'b', sold: 7, complimentary: 1 }], recipes);
    expect(out).toHaveLength(1);
    expect(out[0].windowSold).toBe(0);
    expect(out[0].totalSold).toBe(7);
  });

  it('agrupa lo que no tiene receta y marca recetas eliminadas', () => {
    const out = buildWeeklyRecipeReport(
      weeks,
      [
        { recipeId: null, year: 2026, week: 46, sold: 4, complimentary: 0 },
        { recipeId: 'zzz', year: 2026, week: 46, sold: 1, complimentary: 0 },
      ],
      [],
      recipes
    );
    expect(out.map((r) => r.name)).toEqual(['Sin receta', 'Receta eliminada']);
  });
});
