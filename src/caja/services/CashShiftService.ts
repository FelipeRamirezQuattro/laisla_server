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
