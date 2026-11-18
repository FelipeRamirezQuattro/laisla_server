import { describe, expect, it } from 'vitest';
import { buildCustomerBaseline, isValidMonth, mergeOverheadSuggestion, monthLabel, monthRange, previousMonth } from './MonthlyBaselineService';

describe('meses', () => {
  it('mes anterior, incluido el cambio de año', () => {
    expect(previousMonth(new Date('2026-11-18T15:00:00Z'))).toBe('2026-10');
    expect(previousMonth(new Date('2026-01-05T15:00:00Z'))).toBe('2025-12');
  });
  it('usa la fecha de Colombia: el 1.º de mes a las 00:30 en Colombia (05:30 UTC) ya es el mes nuevo', () => {
    expect(previousMonth(new Date('2026-12-01T05:30:00Z'))).toBe('2026-11');
    // 30-nov 23:30 en Colombia = 1-dic 04:30 UTC: todavía es noviembre allá
    expect(previousMonth(new Date('2026-12-01T04:30:00Z'))).toBe('2026-10');
  });
  it('rango del mes en hora de Colombia', () => {
    const { start, end } = monthRange('2026-10');
    expect(start.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T04:59:59.999Z');
  });
  it('febrero bisiesto y no bisiesto', () => {
    expect(monthRange('2028-02').end.toISOString().slice(0, 10)).toBe('2028-03-01'); // 29 días
    expect(monthRange('2027-02').end.toISOString().slice(0, 10)).toBe('2027-03-01'); // 28 días
  });
  it('validación y etiqueta', () => {
    expect(isValidMonth('2026-10')).toBe(true);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('26-10')).toBe(false);
    expect(monthLabel('2026-10')).toBe('octubre 2026');
  });
});

describe('buildCustomerBaseline', () => {
  it('clientes = pedidos y productos/cliente = unidades ÷ pedidos (2 decimales)', () => {
    expect(buildCustomerBaseline({ orders: 600, units: 1_250 })).toEqual({
      available: true, orders: 600, units: 1_250, monthlyCustomers: 600, productsPerCustomer: 2.08,
    });
  });
  it('sin pedidos no hay sugerencia (y los mínimos del esquema se respetan)', () => {
    const b = buildCustomerBaseline({ orders: 0, units: 0 });
    expect(b.available).toBe(false);
    expect(b.monthlyCustomers).toBe(1);
    expect(b.productsPerCustomer).toBe(1);
  });
  it('productos/cliente nunca baja de 1', () => {
    expect(buildCustomerBaseline({ orders: 10, units: 5 }).productsPerCustomer).toBe(1);
  });
});

describe('mergeOverheadSuggestion', () => {
  const current = [
    { concept: 'Arriendo', monthlyCost: 2_800_000 },
    { concept: 'Energía', monthlyCost: 500_000 },
    { concept: 'Internet', monthlyCost: 150_000 },
  ];

  it('lo pagado reemplaza el valor actual; lo no pagado se conserva; lo nuevo se agrega', () => {
    const r = mergeOverheadSuggestion(current, [
      { concept: 'Arriendo', paid: 3_000_000 },
      { concept: 'energia ', paid: 420_000 }, // sin tilde ni mayúscula: es el mismo concepto
      { concept: 'Seguro', paid: 90_000 },
    ]);
    expect(r.items).toEqual([
      { concept: 'Arriendo', current: 2_800_000, paid: 3_000_000, status: 'PAGADO', suggested: 3_000_000 },
      { concept: 'Energía', current: 500_000, paid: 420_000, status: 'PAGADO', suggested: 420_000 },
      { concept: 'Internet', current: 150_000, paid: 0, status: 'SIN_PAGOS', suggested: 150_000 },
      { concept: 'Seguro', current: 0, paid: 90_000, status: 'NUEVO', suggested: 90_000 },
    ]);
    expect(r.totalPaid).toBe(3_510_000);
    expect(r.currentTotal).toBe(3_450_000);
    expect(r.suggestedTotal).toBe(3_660_000);
  });

  it('suma varios pagos del mismo concepto', () => {
    const r = mergeOverheadSuggestion([{ concept: 'Agua', monthlyCost: 200_000 }], [{ concept: 'Agua', paid: 100_000 }, { concept: 'AGUA', paid: 120_000 }]);
    expect(r.items[0]).toMatchObject({ paid: 220_000, suggested: 220_000, status: 'PAGADO' });
  });

  it('sin ningún pago deja todo como está', () => {
    const r = mergeOverheadSuggestion(current, []);
    expect(r.suggestedTotal).toBe(r.currentTotal);
    expect(r.items.every((i) => i.status === 'SIN_PAGOS')).toBe(true);
  });
});
