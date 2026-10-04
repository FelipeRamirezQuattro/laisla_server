// Pure transform from a legacy (day-granularity) CashClosing doc into the
// fields of its replacement CashShift, plus the DailyExpense ids that need
// relinking. No Mongoose calls here — the migration script does the I/O,
// this does the arithmetic/shape mapping so it can be unit-tested directly.

export interface LegacyExpenseLike {
  description: string;
  amount: number;
  source?: 'manual' | 'daily_expense';
  expenseId?: unknown;
}

export interface LegacyCashClosingLike {
  _id: unknown;
  date: Date;
  openingCash: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  expenses: LegacyExpenseLike[];
  totalExpenses: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  notes?: string;
  closedBy: unknown;
}

export interface MigratedShiftFields {
  status: 'REVIEWED';
  openedBy: unknown;
  openedAt: Date;
  openingFloat: { denominations: []; total: number; countedBy: unknown; countedAt: Date };
  closingCount: { denominations: []; total: number; countedBy: unknown; countedAt: Date };
  closedBy: unknown;
  closedAt: Date;
  salesSnapshot: {
    cashSales: number;
    cardSales: number;
    nequiSales: number;
    transferSales: number;
    totalSales: number;
    totalOrders: number;
    unassignedOrdersCount: number;
  };
  totalExpenses: number;
  totalWithdrawals: number;
  totalCashIn: number;
  expectedCash: number;
  difference: number;
  notes: string;
  migratedFromLegacy: true;
  legacySourceId: unknown;
  legacyManualExpenses: { description: string; amount: number }[];
}

export interface MigrationResult {
  shift: MigratedShiftFields;
  expenseIdsToLink: unknown[];
}

export function migrateLegacyClosingToShift(closing: LegacyCashClosingLike): MigrationResult {
  const expenseIdsToLink = closing.expenses
    .filter((e) => e.source === 'daily_expense' && e.expenseId != null)
    .map((e) => e.expenseId);

  const legacyManualExpenses = closing.expenses
    .filter((e) => e.source !== 'daily_expense')
    .map((e) => ({ description: e.description, amount: e.amount }));

  const shift: MigratedShiftFields = {
    status: 'REVIEWED',
    openedBy: closing.closedBy,
    openedAt: closing.date,
    openingFloat: { denominations: [], total: closing.openingCash, countedBy: closing.closedBy, countedAt: closing.date },
    closingCount: { denominations: [], total: closing.actualCash, countedBy: closing.closedBy, countedAt: closing.date },
    closedBy: closing.closedBy,
    closedAt: closing.date,
    salesSnapshot: {
      cashSales: closing.cashSales,
      cardSales: closing.cardSales,
      nequiSales: 0,
      transferSales: closing.transferSales,
      totalSales: closing.cashSales + closing.cardSales + closing.transferSales,
      totalOrders: 0,
      unassignedOrdersCount: 0,
    },
    totalExpenses: closing.totalExpenses,
    totalWithdrawals: 0,
    totalCashIn: 0,
    expectedCash: closing.expectedCash,
    difference: closing.difference,
    notes: closing.notes ?? '',
    migratedFromLegacy: true,
    legacySourceId: closing._id,
    legacyManualExpenses,
  };

  return { shift, expenseIdsToLink };
}
