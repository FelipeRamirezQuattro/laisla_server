// ---- Pure decision helpers (unit-tested directly in CashShiftService.test.ts) ----
// Mirrors the split already used by PrintJobService/FiscalDocumentService:
// pure calculation here, Mongoose orchestration below.

export interface DenominationCount {
  value: number;
  quantity: number;
}

export function sumDenominations(denominations: DenominationCount[]): number {
  return denominations.reduce((sum, d) => sum + d.value * d.quantity, 0);
}

export interface ExpectedCashInput {
  openingFloatTotal: number;
  cashSales: number;
  totalCashIn: number;
  totalWithdrawals: number;
  totalExpenses: number;
}

// base inicial + ventas en efectivo + ingresos manuales − gastos en efectivo − retiros parciales
export function computeExpectedCash(input: ExpectedCashInput): number {
  return (
    input.openingFloatTotal +
    input.cashSales +
    input.totalCashIn -
    input.totalWithdrawals -
    input.totalExpenses
  );
}

export function computeDifference(countedTotal: number, expectedCash: number): number {
  return countedTotal - expectedCash;
}

export interface DifferenceThresholds {
  justification: number;
  approval: number;
}

export function requiresJustification(difference: number, thresholds: DifferenceThresholds): boolean {
  return Math.abs(difference) > thresholds.justification;
}

export function requiresApproval(difference: number, thresholds: DifferenceThresholds): boolean {
  return Math.abs(difference) > thresholds.approval;
}

// Order→shift assignment at bill time: non-blocking, "sin turno" when none is open.
export function resolveOrderShiftId(openShift: { _id: unknown } | null): unknown | null {
  return openShift ? openShift._id : null;
}

const ADMIN_ROLES = new Set(['admin', 'superadmin']);

export function isAdminRole(role: string | undefined): boolean {
  return !!role && ADMIN_ROLES.has(role);
}

export interface SalesByPaymentMethodInput {
  paymentMethod?: string | null;
  total: number;
}

export interface SalesByPaymentMethodSummary {
  cashSales: number;
  cardSales: number;
  nequiSales: number;
  transferSales: number;
  totalSales: number;
  totalOrders: number;
}

// Replaces the inline cash/card/transfer-only reduce that used to live in
// cashClosingController — adds nequi and is unit-tested directly instead of
// only being exercised through the (now-deleted) controller.
export function summarizeSalesByPaymentMethod(
  orders: SalesByPaymentMethodInput[]
): SalesByPaymentMethodSummary {
  const summary = {
    cashSales: 0,
    cardSales: 0,
    nequiSales: 0,
    transferSales: 0,
    totalSales: 0,
    totalOrders: orders.length,
  };

  for (const order of orders) {
    switch (order.paymentMethod) {
      case 'cash':
        summary.cashSales += order.total;
        break;
      case 'card':
        summary.cardSales += order.total;
        break;
      case 'nequi':
        summary.nequiSales += order.total;
        break;
      case 'transfer':
        summary.transferSales += order.total;
        break;
      default:
        break;
    }
    if (order.paymentMethod) summary.totalSales += order.total;
  }

  return summary;
}

// ---- Account balances (Caja module) ----

export interface ExpenseAccountInput {
  amount: number;
  paymentMethod?: string | null;
  cashAccount?: string | null;
}

// Legacy expenses have no account fields: they were all paid from the till drawer in cash.
export function isDrawerExpense(expense: ExpenseAccountInput): boolean {
  return (expense.paymentMethod ?? 'cash') === 'cash' && (expense.cashAccount ?? 'menor') === 'menor';
}

export function sumDrawerExpenses(expenses: ExpenseAccountInput[]): number {
  return expenses.filter(isDrawerExpense).reduce((sum, e) => sum + e.amount, 0);
}

// Till drawer while no shift is open: what the last closing count left in it,
// minus drawer expenses made since, adjusted by off-shift till movements.
export function computeIdleDrawer(input: {
  lastClosingTotal: number;
  offShiftDrawerExpenses: number;
  offShiftCashIn: number;
  offShiftWithdrawals: number;
}): number {
  return input.lastClosingTotal - input.offShiftDrawerExpenses + input.offShiftCashIn - input.offShiftWithdrawals;
}

export interface AccountBalancesInput {
  sales: { cashSales: number; cardSales: number; nequiSales: number; transferSales: number };
  expenses: ExpenseAccountInput[];
  // Cash that entered the system as the till's starting float (not a sale): the very first shift's opening count.
  initialCash: number;
  // Cash that should currently be in the till drawer (caja menor).
  drawer: number;
}

export interface AccountBalances {
  cash: { total: number; menor: number; general: number };
  card: number;
  transfer: number;
  nequi: number;
}

// Non-cash accounts: sales − expenses paid with that method.
// Cash: total = initial float + cash sales − cash expenses; caja menor is the drawer,
// caja general is whatever cash is not in the drawer.
export function computeAccountBalances(input: AccountBalancesInput): AccountBalances {
  const spent = (method: string) =>
    input.expenses.filter((e) => (e.paymentMethod ?? 'cash') === method).reduce((sum, e) => sum + e.amount, 0);
  const cashTotal = input.initialCash + input.sales.cashSales - spent('cash');
  return {
    cash: { total: cashTotal, menor: input.drawer, general: cashTotal - input.drawer },
    card: input.sales.cardSales - spent('card'),
    transfer: input.sales.transferSales - spent('transfer'),
    nequi: input.sales.nequiSales - spent('nequi'),
  };
}
