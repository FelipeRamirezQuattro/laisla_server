import ActualResult from '../models/ActualResult';

export async function generateInsights(
  year: number,
  month: number,
  current: {
    totalSales: number;
    costOfSalesPct: number;
    grossMarginPct: number;
    netProfit: number;
    totalOperatingExpenses: number;
    expenses: { paidAds: number; founderPayroll: number };
  }
): Promise<string[]> {
  const insights: string[] = [];

  const prev = await ActualResult.findOne({ year, month: month - 1 }).lean();
  const prevYear = await ActualResult.findOne({ year: year - 1, month: 12 }).lean();
  const prevMonthData = prev ?? prevYear;

  if (prevMonthData) {
    // Cost of sales spike
    const prevCostPct = prevMonthData.costOfSalesPct ?? 0;
    if (current.costOfSalesPct - prevCostPct > 0.02) {
      const diff = ((current.costOfSalesPct - prevCostPct) * 100).toFixed(1);
      insights.push(
        `⚠️ Costo de ventas subió ${diff}pp vs el mes anterior — revisar precios de insumos`
      );
    }

    // Gross margin drop
    const prevGM = prevMonthData.grossMarginPct ?? 0;
    if (prevGM - current.grossMarginPct > 0.05) {
      const diff = ((prevGM - current.grossMarginPct) * 100).toFixed(1);
      insights.push(`⚠️ Margen bruto cayó ${diff}pp este mes`);
    }

    // Paid ads down but sales not growing
    const prevAds = prevMonthData.expenses?.paidAds ?? 0;
    const prevSales = prevMonthData.totalSales ?? 0;
    const salesGrowth = prevSales > 0 ? (current.totalSales - prevSales) / prevSales : 0;
    if (prevAds > 0 && current.expenses.paidAds < prevAds * 0.9 && salesGrowth < 0.03) {
      insights.push(
        `⚠️ La pauta pagada bajó más del 10% pero las ventas no crecieron al ritmo esperado`
      );
    }
  }

  // Founder payroll > 30% of operating expenses
  if (
    current.totalOperatingExpenses > 0 &&
    current.expenses.founderPayroll / current.totalOperatingExpenses > 0.3
  ) {
    insights.push(
      `🔍 Nómina de socios supera el 30% de gastos operativos — revisión recomendada`
    );
  }

  // Three consecutive profitable months
  if (current.netProfit > 0) {
    const twoMonthsBack = await ActualResult.find({
      $or: [
        { year, month: { $in: [month - 1, month - 2] } },
        ...(month <= 2
          ? [{ year: year - 1, month: { $in: [month === 1 ? 12 : 11, month === 1 ? 11 : 12] } }]
          : []),
      ],
    }).lean();

    if (twoMonthsBack.length === 2 && twoMonthsBack.every((r) => (r.netProfit ?? 0) > 0)) {
      insights.push(`✅ Tres meses seguidos con utilidad positiva — tendencia saludable`);
    }
  }

  return insights;
}
