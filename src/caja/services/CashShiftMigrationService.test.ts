import { describe, it, expect } from 'vitest';
import { migrateLegacyClosingToShift } from './CashShiftMigrationService';

const baseClosing = {
  _id: 'closing-1',
  date: new Date('2026-05-01T00:00:00.000Z'),
  openingCash: 100000,
  cashSales: 250000,
  cardSales: 80000,
  transferSales: 20000,
  expenses: [
    { description: 'Hielo', amount: 15000, source: 'daily_expense' as const, expenseId: 'expense-1' },
    { description: 'Domicilio urgente', amount: 8000, source: 'manual' as const },
  ],
  totalExpenses: 23000,
  expectedCash: 100000 + 250000 - 23000,
  actualCash: 326000,
  difference: 326000 - (100000 + 250000 - 23000),
  notes: 'Cierre migrado de prueba',
  closedBy: 'user-1',
};

describe('migrateLegacyClosingToShift', () => {
  it('reproduces the exact expectedCash/difference from the legacy doc, with no data loss', () => {
    const { shift } = migrateLegacyClosingToShift(baseClosing);
    expect(shift.expectedCash).toBe(baseClosing.expectedCash);
    expect(shift.difference).toBe(baseClosing.difference);
    expect(shift.totalExpenses).toBe(baseClosing.totalExpenses);
  });

  it('marks the migrated shift as REVIEWED, legacy-sourced, and links back to the original doc', () => {
    const { shift } = migrateLegacyClosingToShift(baseClosing);
    expect(shift.status).toBe('REVIEWED');
    expect(shift.migratedFromLegacy).toBe(true);
    expect(shift.legacySourceId).toBe('closing-1');
    expect(shift.openedBy).toBe('user-1');
    expect(shift.closedBy).toBe('user-1');
  });

  it('carries the sales breakdown across, defaulting nequiSales to 0 (did not exist historically)', () => {
    const { shift } = migrateLegacyClosingToShift(baseClosing);
    expect(shift.salesSnapshot).toMatchObject({
      cashSales: 250000,
      cardSales: 80000,
      nequiSales: 0,
      transferSales: 20000,
      totalSales: 250000 + 80000 + 20000,
    });
  });

  it('keeps only manual-sourced expenses as legacyManualExpenses (daily_expense ones already live in DailyExpense)', () => {
    const { shift } = migrateLegacyClosingToShift(baseClosing);
    expect(shift.legacyManualExpenses).toEqual([{ description: 'Domicilio urgente', amount: 8000 }]);
  });

  it('returns the DailyExpense ids that must be relinked to the new shift', () => {
    const { expenseIdsToLink } = migrateLegacyClosingToShift(baseClosing);
    expect(expenseIdsToLink).toEqual(['expense-1']);
  });

  it('stores the opening/closing cash counts without a denomination breakdown (none existed historically)', () => {
    const { shift } = migrateLegacyClosingToShift(baseClosing);
    expect(shift.openingFloat).toMatchObject({ total: 100000, denominations: [] });
    expect(shift.closingCount).toMatchObject({ total: 326000, denominations: [] });
  });

  it('handles a closing with no manual expenses at all', () => {
    const { shift, expenseIdsToLink } = migrateLegacyClosingToShift({
      ...baseClosing,
      expenses: [{ description: 'Hielo', amount: 15000, source: 'daily_expense' as const, expenseId: 'expense-9' }],
    });
    expect(shift.legacyManualExpenses).toEqual([]);
    expect(expenseIdsToLink).toEqual(['expense-9']);
  });
});
