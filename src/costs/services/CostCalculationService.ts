import { MeasurementUnit, toBaseQuantity } from '../../utils/measurementUnits';

export type { MeasurementUnit };
export type RecipeIngredientUnit = MeasurementUnit;
export type CostingMethod = 'food-cost' | 'full-cost';

export function normalizeToBaseUnit(quantity: number, unit: MeasurementUnit): number {
  return toBaseQuantity(quantity, unit);
}

export function calcPricePerUnit(
  totalPrice: number,
  quantityPerPresentation: number,
  unit: MeasurementUnit = 'UND'
): number {
  const baseQuantity = normalizeToBaseUnit(quantityPerPresentation, unit);
  if (baseQuantity <= 0) return 0;
  return totalPrice / baseQuantity;
}

export function calcIngredientCost(quantity: number, pricePerUnit: number): number {
  return quantity * pricePerUnit;
}

export function calcDisposablePackCost(
  items: Array<{ quantity: number; pricePerUnit: number }>
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
}

export interface VariantCostInput {
  ingredientCosts: number[];
  disposablePackCost: number;
  laborPerItem: number;
  overheadPerItem: number;
  preparationTimeMinutes?: number;
  laborCostPerMinute?: number;
  salePrice: number;
  costingMethod?: CostingMethod;
  targetMargin?: number;
  targetFoodCostPct?: number;
  ivaRate: number;
  taxRate?: number;
  taxIncluded?: boolean;
}

export interface VariantCostResult {
  directMaterialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  profitAmount: number;
  profitPct: number;
  grossMarginPct: number;
  suggestedPrice: number;
  salePriceWithoutTax: number;
  taxAmount: number;
  finalPrice: number;
}

export function calcVariantCosts(input: VariantCostInput): VariantCostResult {
  const costingMethod = input.costingMethod ?? 'food-cost';
  const directMaterialCost =
    input.ingredientCosts.reduce((a, b) => a + b, 0) + input.disposablePackCost;
  const laborCost =
    costingMethod === 'full-cost' && input.preparationTimeMinutes && input.preparationTimeMinutes > 0
      ? input.preparationTimeMinutes * (input.laborCostPerMinute ?? 0)
      : costingMethod === 'full-cost'
        ? input.laborPerItem
        : 0;
  const overheadCost = costingMethod === 'full-cost' ? input.overheadPerItem : 0;
  const totalCost = directMaterialCost + laborCost + overheadCost;
  const taxRate = input.taxRate ?? input.ivaRate ?? 0;
  const taxIncluded = input.taxIncluded ?? true;
  const salePriceWithoutTax = taxIncluded
    ? input.salePrice / (1 + taxRate)
    : input.salePrice;
  const taxAmount = salePriceWithoutTax * taxRate;
  const finalPrice = taxIncluded ? input.salePrice : salePriceWithoutTax + taxAmount;
  const profitAmount = salePriceWithoutTax - totalCost;
  const profitPct = totalCost > 0 ? profitAmount / totalCost : 0;
  const grossMarginPct =
    salePriceWithoutTax > 0 ? profitAmount / salePriceWithoutTax : 0;
  const suggestedNetPrice = costingMethod === 'food-cost'
    ? input.targetFoodCostPct && input.targetFoodCostPct > 0 && input.targetFoodCostPct < 1
      ? directMaterialCost / input.targetFoodCostPct
      : 0
    : input.targetMargin && input.targetMargin > 0 && input.targetMargin < 1
      ? totalCost / (1 - input.targetMargin)
      : 0;
  const suggestedPrice = taxRate > 0 ? suggestedNetPrice * (1 + taxRate) : suggestedNetPrice;
  return {
    directMaterialCost,
    laborCost,
    overheadCost,
    totalCost,
    profitAmount,
    profitPct,
    grossMarginPct,
    suggestedPrice,
    salePriceWithoutTax,
    taxAmount,
    finalPrice,
  };
}

export interface MODInput {
  hourlyWage: number;
  numberOfWorkers: number;
  hoursPerDay: number;
  numberOfShifts: number;
  monthlyCustomers: number;
  productsPerCustomer: number;
}

export interface MODResult {
  totalHourlyWage: number;
  dailyLabor: number;
  monthlyLabor: number;
  laborPerItem: number;
}

export function calcMOD(input: MODInput): MODResult {
  const totalHourlyWage = input.hourlyWage * input.numberOfWorkers * input.hoursPerDay;
  const dailyLabor = totalHourlyWage * input.numberOfShifts;
  const monthlyLabor = dailyLabor * 30.4;
  const denominator = input.monthlyCustomers * input.productsPerCustomer;
  const laborPerItem = denominator > 0 ? monthlyLabor / denominator : 0;
  return { totalHourlyWage, dailyLabor, monthlyLabor, laborPerItem };
}

export interface GIFInput {
  overheadItems: Array<{ monthlyCost: number }>;
  monthlyCustomers: number;
  productsPerCustomer: number;
}

export interface GIFResult {
  totalMonthlyOverhead: number;
  dailyOverhead: number;
  overheadPerItem: number;
}

export function calcGIF(input: GIFInput): GIFResult {
  const totalMonthlyOverhead = input.overheadItems.reduce((s, i) => s + i.monthlyCost, 0);
  const dailyOverhead = totalMonthlyOverhead / 30.4;
  const denominator = input.monthlyCustomers * input.productsPerCustomer;
  const overheadPerItem = denominator > 0 ? totalMonthlyOverhead / denominator : 0;
  return { totalMonthlyOverhead, dailyOverhead, overheadPerItem };
}

export interface MonthProjectionInput {
  dailyTickets: number;
  workingDaysPerMonth: number;
  averageTicket: number;
  costOfSalesPct: number;
  operatingExpenses: number;
}

export interface MonthProjectionResult {
  monthlyTickets: number;
  dailySales: number;
  monthlySales: number;
  costOfSales: number;
  totalExpenses: number;
  profit: number;
}

export function calcMonthProjection(input: MonthProjectionInput): MonthProjectionResult {
  const monthlyTickets = input.dailyTickets * input.workingDaysPerMonth;
  const dailySales = input.dailyTickets * input.averageTicket;
  const monthlySales = monthlyTickets * input.averageTicket;
  const costOfSales = monthlySales * input.costOfSalesPct;
  const totalExpenses = costOfSales + input.operatingExpenses;
  const profit = monthlySales - totalExpenses;
  return { monthlyTickets, dailySales, monthlySales, costOfSales, totalExpenses, profit };
}

export function growProjectionDailyTickets(
  months: Array<{ dailyTickets: number; isManualOverride: boolean }>,
  growthRate: number
): number[] {
  const result = months.map((m) => m.dailyTickets);
  for (let i = 1; i < 12; i++) {
    if (!months[i].isManualOverride) {
      result[i] = result[i - 1] * (1 + growthRate);
    }
  }
  return result;
}

export interface ActualResultInput {
  totalSales: number;
  costOfSales: number;
  expenses: {
    payroll: number;
    founderPayroll: number;
    rent: number;
    bankFees: number;
    utilities: number;
    maintenance: number;
    marketing: number;
    paidAds: number;
    musicRights: number;
    accounting: number;
    other: number;
  };
}

export interface ActualResultCalc {
  costOfSalesPct: number;
  grossMargin: number;
  grossMarginPct: number;
  totalOperatingExpenses: number;
  netProfit: number;
  netProfitPct: number;
}

const actualExpenseKeys: Array<keyof ActualResultInput['expenses']> = [
  'payroll',
  'founderPayroll',
  'rent',
  'bankFees',
  'utilities',
  'maintenance',
  'marketing',
  'paidAds',
  'musicRights',
  'accounting',
  'other',
];

function safeNumber(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function calcActualResult(input: ActualResultInput): ActualResultCalc {
  const totalSales = safeNumber(input.totalSales);
  const costOfSales = safeNumber(input.costOfSales);
  const costOfSalesPct = totalSales > 0 ? costOfSales / totalSales : 0;
  const grossMargin = totalSales - costOfSales;
  const grossMarginPct = totalSales > 0 ? grossMargin / totalSales : 0;
  const totalOperatingExpenses = actualExpenseKeys.reduce(
    (sum, key) => sum + safeNumber(input.expenses?.[key]),
    0
  );
  const netProfit = grossMargin - totalOperatingExpenses;
  const netProfitPct = totalSales > 0 ? netProfit / totalSales : 0;
  return { costOfSalesPct, grossMargin, grossMarginPct, totalOperatingExpenses, netProfit, netProfitPct };
}
