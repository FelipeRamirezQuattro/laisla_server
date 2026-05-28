import { Response } from 'express';
import { AuthRequest } from '../../types';
import ActualResult from '../models/ActualResult';
import { calcActualResult } from '../services/CostCalculationService';
import { generateInsights } from '../services/InsightService';

async function buildAndSave(
  doc: InstanceType<typeof ActualResult>,
  req: AuthRequest
): Promise<void> {
  const calc = calcActualResult({
    totalSales: doc.totalSales,
    costOfSales: doc.costOfSales,
    expenses: doc.expenses,
  });
  Object.assign(doc, calc);

  // variation vs previous month
  const prevMonth = doc.month === 1
    ? await ActualResult.findOne({ year: doc.year - 1, month: 12 }).lean()
    : await ActualResult.findOne({ year: doc.year, month: doc.month - 1 }).lean();

  if (prevMonth) {
    doc.variationVsPrevMonth = {
      totalSales: prevMonth.totalSales > 0
        ? ((doc.totalSales - prevMonth.totalSales) / prevMonth.totalSales) * 100
        : 0,
      netProfit: prevMonth.netProfit !== 0
        ? ((doc.netProfit - prevMonth.netProfit) / Math.abs(prevMonth.netProfit)) * 100
        : 0,
      grossMarginPct: doc.grossMarginPct - prevMonth.grossMarginPct,
    };
  }

  doc.insights = await generateInsights(doc.year, doc.month, {
    totalSales: doc.totalSales,
    costOfSalesPct: doc.costOfSalesPct,
    grossMarginPct: doc.grossMarginPct,
    netProfit: doc.netProfit,
    totalOperatingExpenses: doc.totalOperatingExpenses,
    expenses: { paidAds: doc.expenses.paidAds, founderPayroll: doc.expenses.founderPayroll },
  });
}

export async function getYearResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    const year = parseInt(req.params.year, 10);
    const results = await ActualResult.find({ year }).sort({ month: 1 });
    res.json(results);
  } catch {
    res.status(500).json({ error: 'Error al obtener resultados' });
  }
}

export async function createResult(req: AuthRequest, res: Response): Promise<void> {
  try {
    const existing = await ActualResult.findOne({ year: req.body.year, month: req.body.month });
    if (existing) { res.status(409).json({ error: 'Ya existe un resultado para ese mes' }); return; }
    const doc = new ActualResult(req.body);
    await buildAndSave(doc, req);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear resultado', details: String(err) });
  }
}

export async function updateResult(req: AuthRequest, res: Response): Promise<void> {
  try {
    const doc = await ActualResult.findById(req.params.id);
    if (!doc) { res.status(404).json({ error: 'Resultado no encontrado' }); return; }
    Object.assign(doc, req.body);
    await buildAndSave(doc, req);
    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar resultado', details: String(err) });
  }
}

export async function getMonthResult(req: AuthRequest, res: Response): Promise<void> {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const result = await ActualResult.findOne({ year, month });
    if (!result) { res.status(404).json({ error: 'Resultado no encontrado' }); return; }
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error al obtener resultado' });
  }
}

export async function getYearSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const year = parseInt(req.params.year, 10);
    const results = await ActualResult.find({ year }).lean();
    const summary = results.reduce(
      (acc, r) => ({
        totalSales: acc.totalSales + r.totalSales,
        costOfSales: acc.costOfSales + r.costOfSales,
        grossMargin: acc.grossMargin + r.grossMargin,
        totalOperatingExpenses: acc.totalOperatingExpenses + r.totalOperatingExpenses,
        netProfit: acc.netProfit + r.netProfit,
      }),
      { totalSales: 0, costOfSales: 0, grossMargin: 0, totalOperatingExpenses: 0, netProfit: 0 }
    );
    const grossMarginPct = summary.totalSales > 0 ? summary.grossMargin / summary.totalSales : 0;
    const netProfitPct = summary.totalSales > 0 ? summary.netProfit / summary.totalSales : 0;
    res.json({ year, monthsRecorded: results.length, ...summary, grossMarginPct, netProfitPct });
  } catch {
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
}
