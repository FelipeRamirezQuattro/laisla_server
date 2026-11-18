import { describe, expect, it } from 'vitest';
import { buildSalesTrends, isoDow, listDates } from './salesTrends';

describe('fechas', () => {
  it('lista el rango completo e incluyente', () => {
    expect(listDates('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  });
  it('día ISO: lunes = 1, domingo = 7', () => {
    expect(isoDow('2026-11-09')).toBe(1); // lunes
    expect(isoDow('2026-11-14')).toBe(6); // sábado
    expect(isoDow('2026-11-15')).toBe(7); // domingo
  });
});

describe('buildSalesTrends', () => {
  // 01-nov (domingo) a 15-nov (domingo): 15 días
  const from = '2026-11-01';
  const to = '2026-11-15';
  const heat = [
    { dow: 6, hour: 10, units: 7, revenue: 35000 },
    { dow: 6, hour: 15, units: 2, revenue: 10000 },
    { dow: 7, hour: 23, units: 1, revenue: 5000 },
    { dow: 6, hour: 10, units: 1, revenue: 1000 }, // filas repetidas se suman
  ];
  const daily = [
    { date: '2026-11-07', units: 4, revenue: 20000 },
    { date: '2026-11-14', units: 5, revenue: 25000 },
  ];
  const t = buildSalesTrends({ from, to, heat, daily });

  it('completa la grilla 7×24 con ceros', () => {
    expect(t.heatmap).toHaveLength(168);
    expect(t.heatmap.find((c) => c.dow === 1 && c.hour === 8)).toEqual({ dow: 1, hour: 8, units: 0, revenue: 0 });
    expect(t.heatmap.find((c) => c.dow === 6 && c.hour === 10)!.units).toBe(8);
  });

  it('totales y rango', () => {
    expect(t.range).toEqual({ from, to, days: 15 });
    expect(t.totals).toEqual({ units: 11, revenue: 51000 });
  });

  it('promedia por día de la semana según cuántas veces ocurre en el rango', () => {
    const sat = t.byWeekday.find((w) => w.dow === 6)!;
    const sun = t.byWeekday.find((w) => w.dow === 7)!;
    expect(sat).toMatchObject({ label: 'Sábado', units: 10, occurrences: 2, avgUnits: 5 });
    expect(sun).toMatchObject({ units: 1, occurrences: 3, avgUnits: 0.3 });
  });

  it('serie diaria con un punto por día, rellenando ceros', () => {
    expect(t.daily).toHaveLength(15);
    expect(t.daily.find((d) => d.date === '2026-11-07')!.units).toBe(4);
    expect(t.daily.find((d) => d.date === '2026-11-08')).toEqual({ date: '2026-11-08', units: 0, revenue: 0 });
  });

  it('detecta los picos', () => {
    expect(t.peaks.cell).toEqual({ dow: 6, label: 'Sábado', hour: 10, units: 8 });
    expect(t.peaks.weekday).toEqual({ dow: 6, label: 'Sábado', avgUnits: 5 });
    expect(t.peaks.hour).toEqual({ hour: 10, units: 8 });
    expect(t.byHour.find((h) => h.hour === 10)!.avgUnitsPerDay).toBe(0.5);
  });

  it('sin ventas no hay picos', () => {
    const empty = buildSalesTrends({ from, to, heat: [], daily: [] });
    expect(empty.peaks).toEqual({ cell: null, weekday: null, hour: null });
    expect(empty.totals).toEqual({ units: 0, revenue: 0 });
  });
});
