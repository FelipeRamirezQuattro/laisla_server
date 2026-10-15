import { getOrderPayments } from '../../utils/orderPayments';

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
  payments?: { method: string; amount: number }[] | null;
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
    for (const { method, amount } of getOrderPayments(order)) {
      switch (method) {
        case 'cash':
          summary.cashSales += amount;
          break;
        case 'card':
          summary.cardSales += amount;
          break;
        case 'nequi':
          summary.nequiSales += amount;
          break;
        case 'transfer':
          summary.transferSales += amount;
          break;
      }
      summary.totalSales += amount;
    }
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
  // Signed corrections/transfers per account (see CashAccountAdjustment).
  adjustments?: { general?: number; transfer?: number; nequi?: number; card?: number };
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
  const adj = input.adjustments ?? {};
  const cashTotal = input.initialCash + input.sales.cashSales - spent('cash') + (adj.general ?? 0);
  return {
    cash: { total: cashTotal, menor: input.drawer, general: cashTotal - input.drawer },
    card: input.sales.cardSales - spent('card') + (adj.card ?? 0),
    transfer: input.sales.transferSales - spent('transfer') + (adj.transfer ?? 0),
    nequi: input.sales.nequiSales - spent('nequi') + (adj.nequi ?? 0),
  };
}

// ---- Closing-difference explanation ----

function money(amount: number): string {
  const rounded = Math.round(amount);
  const digits = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${rounded < 0 ? '-' : ''}$${digits}`;
}

export interface ClosingDifferenceInput extends ExpectedCashInput {
  counted: number;
  thresholds: DifferenceThresholds;
}

export interface ClosingDifferenceDetails {
  openingFloat: number;
  cashSales: number;
  totalCashIn: number;
  totalWithdrawals: number;
  totalExpenses: number;
  expectedCash: number;
  counted: number;
  difference: number;
  justificationThreshold: number;
  approvalThreshold: number;
  needsApproval: boolean;
}

// Texto para quien cierra el turno: cuánto debería haber en caja, de dónde sale
// ese número, cuánto se contó y qué hacer. `details` alimenta el panel del UI.
export function buildClosingDifferenceMessage(input: ClosingDifferenceInput): {
  message: string;
  details: ClosingDifferenceDetails;
} {
  const expectedCash = computeExpectedCash(input);
  const difference = computeDifference(input.counted, expectedCash);
  const needsApproval = requiresApproval(difference, input.thresholds);

  const details: ClosingDifferenceDetails = {
    openingFloat: input.openingFloatTotal,
    cashSales: input.cashSales,
    totalCashIn: input.totalCashIn,
    totalWithdrawals: input.totalWithdrawals,
    totalExpenses: input.totalExpenses,
    expectedCash,
    counted: input.counted,
    difference,
    justificationThreshold: input.thresholds.justification,
    approvalThreshold: input.thresholds.approval,
    needsApproval,
  };

  const gap = difference < 0 ? `Faltan ${money(-difference)}` : `Sobran ${money(difference)}`;
  const message =
    `${gap} en caja. Debería haber ${money(expectedCash)}: ` +
    `base inicial ${money(input.openingFloatTotal)} + ventas en efectivo ${money(input.cashSales)} ` +
    `+ ingresos ${money(input.totalCashIn)} − retiros ${money(input.totalWithdrawals)} ` +
    `− gastos en efectivo ${money(input.totalExpenses)}. Contaste ${money(input.counted)}. ` +
    `Revisa el conteo y, si es correcto, escribe en las notas el motivo de la diferencia ` +
    `(se exige justificación por encima de ${money(input.thresholds.justification)}` +
    `${needsApproval ? `; esta diferencia además requerirá aprobación de un administrador al superar ${money(input.thresholds.approval)}` : ''}).`;

  return { message, details };
}
