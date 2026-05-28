import { Response } from 'express';
import { AuthRequest } from '../../types';
import Projection from '../models/Projection';
import ActualResult from '../models/ActualResult';
import { calcMonthProjection, growProjectionDailyTickets } from '../services/CostCalculationService';

export async function getProjection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const year = parseInt(req.params.year, 10);
    const projection = await Projection.findOne({ year });
    if (!projection) { res.status(404).json({ error: 'Proyección no encontrada' }); return; }
    res.json(projection);
  } catch {
    res.status(500).json({ error: 'Error al obtener proyección' });
  }
}

export async function createProjection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { year, growthRate, workingDaysPerMonth } = req.body;
    const existing = await Projection.findOne({ year });
    if (existing) { res.status(409).json({ error: `Ya existe una proyección para ${year}` }); return; }
    const projection = await Projection.create({ year, growthRate, workingDaysPerMonth });
    res.status(201).json(projection);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear proyección', details: String(err) });
  }
}

export async function updateProjectionMonth(req: AuthRequest, res: Response): Promise<void> {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const projection = await Projection.findOne({ year });
    if (!projection) { res.status(404).json({ error: 'Proyección no encontrada' }); return; }

    const monthIndex = month - 1;
    const monthData = projection.months[monthIndex];
    if (!monthData) { res.status(400).json({ error: 'Mes inválido' }); return; }

    const isManualOverride = req.body.isManualOverride ?? true;
    Object.assign(monthData, req.body, { isManualOverride });

    const calc = calcMonthProjection({
      dailyTickets: monthData.dailyTickets,
      workingDaysPerMonth: projection.workingDaysPerMonth,
      averageTicket: monthData.averageTicket,
      costOfSalesPct: monthData.costOfSalesPct,
      operatingExpenses: monthData.operatingExpenses,
    });
    Object.assign(monthData, calc);

    // Apply growth to subsequent non-overridden months
    if (month < 12) {
      const newTickets = growProjectionDailyTickets(
        projection.months.map((m, i) => ({
          dailyTickets: i === monthIndex ? monthData.dailyTickets : m.dailyTickets,
          isManualOverride: i === monthIndex ? false : m.isManualOverride,
        })),
        projection.growthRate
      );
      for (let i = month; i < 12; i++) {
        if (!projection.months[i].isManualOverride) {
          projection.months[i].dailyTickets = newTickets[i];
          const c = calcMonthProjection({
            dailyTickets: newTickets[i],
            workingDaysPerMonth: projection.workingDaysPerMonth,
            averageTicket: projection.months[i].averageTicket,
            costOfSalesPct: projection.months[i].costOfSalesPct,
            operatingExpenses: projection.months[i].operatingExpenses,
          });
          Object.assign(projection.months[i], c);
        }
      }
    }

    projection.markModified('months');
    await projection.save();
    res.json(projection);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar mes', details: String(err) });
  }
}

export async function getComparison(req: AuthRequest, res: Response): Promise<void> {
  try {
    const year = parseInt(req.params.year, 10);
    const [projection, actuals] = await Promise.all([
      Projection.findOne({ year }).lean(),
      ActualResult.find({ year }).lean(),
    ]);
    if (!projection) { res.status(404).json({ error: 'Proyección no encontrada' }); return; }

    const comparison = projection.months.map((proj) => {
      const actual = actuals.find((a) => a.month === proj.month);
      const variationSales =
        proj.monthlySales > 0 && actual
          ? ((actual.totalSales - proj.monthlySales) / proj.monthlySales) * 100
          : null;
      return { month: proj.month, projected: proj, actual: actual ?? null, variationSalesPct: variationSales };
    });

    res.json({ year, comparison });
  } catch {
    res.status(500).json({ error: 'Error al obtener comparativo' });
  }
}
