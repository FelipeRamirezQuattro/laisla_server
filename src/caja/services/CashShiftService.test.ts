import { describe, it, expect } from 'vitest';
import {
  sumDenominations,
  computeExpectedCash,
  computeDifference,
  requiresJustification,
  requiresApproval,
  resolveOrderShiftId,
  isAdminRole,
  summarizeSalesByPaymentMethod,
} from './CashShiftService';

describe('sumDenominations', () => {
  it('sums value*quantity across a mix of bills and coins', () => {
    const total = sumDenominations([
      { value: 100000, quantity: 1 },
      { value: 50000, quantity: 2 },
      { value: 1000, quantity: 5 },
      { value: 500, quantity: 3 },
    ]);
    expect(total).toBe(100000 + 100000 + 5000 + 1500);
  });

  it('returns 0 for an empty list', () => {
    expect(sumDenominations([])).toBe(0);
  });

  it('ignores denominations with zero quantity', () => {
    const total = sumDenominations([
      { value: 100000, quantity: 0 },
      { value: 2000, quantity: 3 },
    ]);
    expect(total).toBe(6000);
  });
});

describe('computeExpectedCash', () => {
  it('adds opening float, cash sales and manual cash-in', () => {
    const result = computeExpectedCash({
      openingFloatTotal: 100000,
      cashSales: 50000,
      totalCashIn: 20000,
      totalWithdrawals: 0,
      totalExpenses: 0,
    });
    expect(result).toBe(170000);
  });

  it('subtracts withdrawals and expenses', () => {
    const result = computeExpectedCash({
      openingFloatTotal: 100000,
      cashSales: 50000,
      totalCashIn: 0,
      totalWithdrawals: 30000,
      totalExpenses: 15000,
    });
    expect(result).toBe(105000);
  });

  it('combines every movement type in one calculation', () => {
    const result = computeExpectedCash({
      openingFloatTotal: 100000,
      cashSales: 80000,
      totalCashIn: 10000,
      totalWithdrawals: 40000,
      totalExpenses: 25000,
    });
    expect(result).toBe(100000 + 80000 + 10000 - 40000 - 25000);
  });

  it('can go negative when expenses/withdrawals exceed available cash', () => {
    const result = computeExpectedCash({
      openingFloatTotal: 10000,
      cashSales: 0,
      totalCashIn: 0,
      totalWithdrawals: 5000,
      totalExpenses: 20000,
    });
    expect(result).toBe(-15000);
  });
});

describe('computeDifference', () => {
  it('is positive when the counted cash exceeds the expected amount', () => {
    expect(computeDifference(105000, 100000)).toBe(5000);
  });

  it('is negative when the counted cash is short', () => {
    expect(computeDifference(95000, 100000)).toBe(-5000);
  });

  it('is zero when the count matches exactly', () => {
    expect(computeDifference(100000, 100000)).toBe(0);
  });
});

describe('requiresJustification', () => {
  const thresholds = { justification: 2000, approval: 10000 };

  it('is false for a difference within the threshold', () => {
    expect(requiresJustification(1500, thresholds)).toBe(false);
  });

  it('is false exactly at the threshold', () => {
    expect(requiresJustification(2000, thresholds)).toBe(false);
  });

  it('is true once the difference exceeds the threshold', () => {
    expect(requiresJustification(2001, thresholds)).toBe(true);
  });

  it('uses the absolute value, so a shortage also triggers it', () => {
    expect(requiresJustification(-2500, thresholds)).toBe(true);
  });
});

describe('requiresApproval', () => {
  const thresholds = { justification: 2000, approval: 10000 };

  it('is false for a difference within the approval threshold', () => {
    expect(requiresApproval(9000, thresholds)).toBe(false);
  });

  it('is false exactly at the threshold', () => {
    expect(requiresApproval(10000, thresholds)).toBe(false);
  });

  it('is true once the difference exceeds the threshold', () => {
    expect(requiresApproval(10001, thresholds)).toBe(true);
  });

  it('uses the absolute value, so a shortage also triggers it', () => {
    expect(requiresApproval(-12000, thresholds)).toBe(true);
  });
});

describe('resolveOrderShiftId', () => {
  it('returns the open shift id when a shift is open', () => {
    expect(resolveOrderShiftId({ _id: 'shift-1' })).toBe('shift-1');
  });

  it('returns null when no shift is open ("sin turno")', () => {
    expect(resolveOrderShiftId(null)).toBeNull();
  });
});

describe('summarizeSalesByPaymentMethod', () => {
  it('splits totals by payment method, including nequi', () => {
    const summary = summarizeSalesByPaymentMethod([
      { paymentMethod: 'cash', total: 30000 },
      { paymentMethod: 'cash', total: 20000 },
      { paymentMethod: 'card', total: 15000 },
      { paymentMethod: 'nequi', total: 8000 },
      { paymentMethod: 'transfer', total: 5000 },
    ]);
    expect(summary).toEqual({
      cashSales: 50000,
      cardSales: 15000,
      nequiSales: 8000,
      transferSales: 5000,
      totalSales: 78000,
      totalOrders: 5,
    });
  });

  it('returns all zeros for an empty order list', () => {
    expect(summarizeSalesByPaymentMethod([])).toEqual({
      cashSales: 0,
      cardSales: 0,
      nequiSales: 0,
      transferSales: 0,
      totalSales: 0,
      totalOrders: 0,
    });
  });

  it('ignores an order with no payment method set (should not happen for billed orders, but defends against bad data)', () => {
    const summary = summarizeSalesByPaymentMethod([
      { paymentMethod: null, total: 10000 },
      { paymentMethod: 'cash', total: 5000 },
    ]);
    expect(summary.cashSales).toBe(5000);
    expect(summary.totalSales).toBe(5000);
    expect(summary.totalOrders).toBe(2);
  });
});

describe('isAdminRole', () => {
  it('is true for admin', () => {
    expect(isAdminRole('admin')).toBe(true);
  });

  it('is true for superadmin', () => {
    expect(isAdminRole('superadmin')).toBe(true);
  });

  it('is false for the plain user role', () => {
    expect(isAdminRole('user')).toBe(false);
  });

  it('is false for an undefined role', () => {
    expect(isAdminRole(undefined)).toBe(false);
  });
});
