import { describe, expect, it } from 'vitest';
import { calcMOD, calcMODFromWorkers, DAYS_PER_MONTH, resolveLabor } from './CostCalculationService';

describe('calcMODFromWorkers', () => {
  // A: 5.000/h × 8 h × 26 días = 1.040.000 · B: 4.000 × 4 × 30,4 = 486.400 · C: 6.000 × 6 × 20 = 720.000
  const workers = [
    { hourlyRate: 5_000, hoursPerDay: 8, daysPerMonth: 26 },
    { hourlyRate: 4_000, hoursPerDay: 4, daysPerMonth: 30.4 },
    { hourlyRate: 6_000, hoursPerDay: 6, daysPerMonth: 20 },
  ];

  it('suma el costo de cada trabajador con su propia tarifa, horas y días', () => {
    const r = calcMODFromWorkers({ workers, monthlyCustomers: 600, productsPerCustomer: 2 });
    expect(r.monthlyLabor).toBeCloseTo(2_246_400, 2);
    expect(r.dailyLabor).toBeCloseTo(2_246_400 / DAYS_PER_MONTH, 4);
    expect(r.totalHourlyWage).toBe(92_000); // 40.000 + 16.000 + 36.000 por día
    expect(r.workersCount).toBe(3);
    expect(r.laborPerItem).toBeCloseTo(1_872, 4); // 2.246.400 / (600 × 2)
  });

  it('el costo por minuto es la suma de tarifas por hora / 60 (misma convención de antes)', () => {
    expect(calcMODFromWorkers({ workers, monthlyCustomers: 600, productsPerCustomer: 2 }).laborCostPerMinute).toBe(250);
  });

  it('con trabajadores iguales coincide con el cálculo manual anterior', () => {
    const same = Array.from({ length: 3 }, () => ({ hourlyRate: 2_000, hoursPerDay: 8, daysPerMonth: DAYS_PER_MONTH }));
    const fromWorkers = calcMODFromWorkers({ workers: same, monthlyCustomers: 600, productsPerCustomer: 2 });
    const legacy = calcMOD({ hourlyWage: 2_000, numberOfWorkers: 3, hoursPerDay: 8, numberOfShifts: 1, monthlyCustomers: 600, productsPerCustomer: 2 });
    expect(fromWorkers.monthlyLabor).toBeCloseTo(legacy.monthlyLabor, 6);
    expect(fromWorkers.dailyLabor).toBeCloseTo(legacy.dailyLabor, 6);
    expect(fromWorkers.totalHourlyWage).toBe(legacy.totalHourlyWage);
    expect(fromWorkers.laborPerItem).toBeCloseTo(legacy.laborPerItem, 6);
    expect(fromWorkers.laborCostPerMinute).toBe((2_000 * 3) / 60);
  });

  it('sin demanda no divide entre cero', () => {
    expect(calcMODFromWorkers({ workers, monthlyCustomers: 0, productsPerCustomer: 2 }).laborPerItem).toBe(0);
  });
});

describe('resolveLabor', () => {
  const manual = { hourlyWage: 2_000, numberOfWorkers: 3, hoursPerDay: 8, numberOfShifts: 1, monthlyCustomers: 600, productsPerCustomer: 2 };

  it('sin trabajadores activos usa los campos manuales (datos existentes intactos)', () => {
    const r = resolveLabor(manual, []);
    expect(r.mode).toBe('MANUAL');
    expect(r.monthlyLabor).toBeCloseTo(1_459_200, 2);
    expect(r.laborPerItem).toBeCloseTo(1_216, 4);
    expect(r.laborCostPerMinute).toBe(100);
  });

  it('con trabajadores activos manda el registro de trabajadores', () => {
    const r = resolveLabor(manual, [{ hourlyRate: 10_000, hoursPerDay: 4, daysPerMonth: 20 }]);
    expect(r.mode).toBe('WORKERS');
    expect(r.monthlyLabor).toBe(800_000);
    expect(r.workersCount).toBe(1);
  });
});
