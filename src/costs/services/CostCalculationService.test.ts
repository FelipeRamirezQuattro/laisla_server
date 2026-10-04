import { describe, expect, it } from 'vitest';
import {
  calcActualResult,
  calcDisposablePackCost,
  calcGIF,
  calcMOD,
  calcMonthProjection,
  calcPricePerUnit,
  calcVariantCosts,
  growProjectionDailyTickets
} from './CostCalculationService';

describe('CostCalculationService', () => {
  it('calculates price per base unit and disposable pack cost', () => {
    expect(calcPricePerUnit(30_000, 2, 'KG')).toBe(15);
    expect(calcDisposablePackCost([
      { quantity: 2, pricePerUnit: 150 },
      { quantity: 1, pricePerUnit: 200 }
    ])).toBe(500);
  });

  it('calculates food-cost pricing without MOD or GIF', () => {
    const result = calcVariantCosts({
      ingredientCosts: [2_000, 1_000],
      disposablePackCost: 500,
      laborPerItem: 700,
      overheadPerItem: 300,
      salePrice: 10_800,
      costingMethod: 'food-cost',
      targetFoodCostPct: 0.35,
      ivaRate: 0.08,
      taxIncluded: true
    });

    expect(result.directMaterialCost).toBe(3_500);
    expect(result.laborCost).toBe(0);
    expect(result.overheadCost).toBe(0);
    expect(result.totalCost).toBe(3_500);
    expect(result.salePriceWithoutTax).toBeCloseTo(10_000);
    expect(result.taxAmount).toBeCloseTo(800);
    expect(result.suggestedPrice).toBeCloseTo(10_800);
  });

  it('calculates full-cost pricing using preparation minutes when present', () => {
    const result = calcVariantCosts({
      ingredientCosts: [2_000],
      disposablePackCost: 500,
      laborPerItem: 700,
      overheadPerItem: 300,
      preparationTimeMinutes: 5,
      laborCostPerMinute: 200,
      salePrice: 10_000,
      costingMethod: 'full-cost',
      targetMargin: 0.4,
      ivaRate: 0,
      taxIncluded: false
    });

    expect(result.laborCost).toBe(1_000);
    expect(result.totalCost).toBe(3_800);
    expect(result.suggestedPrice).toBeCloseTo(6_333.333, 2);
  });

  it('returns safe zero allocations when demand is zero', () => {
    expect(calcMOD({
      hourlyWage: 10_000,
      numberOfWorkers: 2,
      hoursPerDay: 8,
      numberOfShifts: 1,
      monthlyCustomers: 0,
      productsPerCustomer: 2
    }).laborPerItem).toBe(0);
    expect(calcGIF({
      overheadItems: [{ monthlyCost: 1_000_000 }],
      monthlyCustomers: 0,
      productsPerCustomer: 2
    }).overheadPerItem).toBe(0);
  });

  it('calculates monthly projection totals and profit', () => {
    expect(calcMonthProjection({
      dailyTickets: 100,
      workingDaysPerMonth: 25,
      averageTicket: 20_000,
      costOfSalesPct: 0.3,
      operatingExpenses: 15_000_000
    })).toEqual({
      monthlyTickets: 2_500,
      dailySales: 2_000_000,
      monthlySales: 50_000_000,
      costOfSales: 15_000_000,
      totalExpenses: 30_000_000,
      profit: 20_000_000
    });
  });

  it('grows projections while preserving manual overrides', () => {
    const months = Array.from({ length: 12 }, (_, index) => ({
      dailyTickets: index === 2 ? 250 : 100,
      isManualOverride: index === 2
    }));
    const result = growProjectionDailyTickets(months, 0.1);
    expect(result[0]).toBe(100);
    expect(result[1]).toBeCloseTo(110);
    expect(result[2]).toBe(250);
    expect(result[3]).toBeCloseTo(275);
  });

  it('calculates actual results and ignores non-finite expense values', () => {
    const result = calcActualResult({
      totalSales: 100_000,
      costOfSales: 30_000,
      expenses: {
        payroll: 10_000,
        founderPayroll: 5_000,
        rent: 8_000,
        bankFees: 1_000,
        utilities: 2_000,
        maintenance: Number.NaN,
        marketing: 3_000,
        paidAds: 1_000,
        musicRights: 500,
        accounting: 1_500,
        other: 2_000
      }
    });
    expect(result.costOfSalesPct).toBe(0.3);
    expect(result.grossMargin).toBe(70_000);
    expect(result.totalOperatingExpenses).toBe(34_000);
    expect(result.netProfit).toBe(36_000);
    expect(result.netProfitPct).toBe(0.36);
  });
});
