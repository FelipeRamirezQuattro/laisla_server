// Capa Mongoose de la sugerencia mensual; las reglas de cálculo están en MonthlyBaselineService.ts.
import DailyExpense from '../../models/DailyExpense';
import Order from '../../models/Order';
import { getBilledOrderMatch } from '../../utils/orderQueries';
import LaborAndOverheadParams from '../models/LaborAndOverheadParams';
import { resolveLabor } from './CostCalculationService';
import { loadActiveWorkers } from './WorkerService';
import {
  buildCustomerBaseline,
  mergeOverheadSuggestion,
  monthLabel,
  monthRange,
  previousMonth,
} from './MonthlyBaselineService';

export async function getMonthlySuggestion(month: string = previousMonth(new Date())) {
  const { start, end } = monthRange(month);
  const params = await LaborAndOverheadParams.findOne().lean();

  const [orderRows, gifRows, laborRows, workers] = await Promise.all([
    // Pedidos facturados del mes con al menos una unidad vendida (cortesías excluidas).
    Order.aggregate<{ orders: number; units: number }>([
      { $match: getBilledOrderMatch({ start, end }) },
      {
        $project: {
          units: {
            $sum: {
              $map: { input: '$items', as: 'i', in: { $cond: [{ $eq: ['$$i.complimentary', true] }, 0, '$$i.quantity'] } },
            },
          },
        },
      },
      { $match: { units: { $gt: 0 } } },
      { $group: { _id: null, orders: { $sum: 1 }, units: { $sum: '$units' } } },
    ]),
    DailyExpense.aggregate<{ _id: string; paid: number }>([
      { $match: { type: 'GIF', date: { $gte: start, $lte: end } } },
      { $group: { _id: '$gifConcept', paid: { $sum: '$amount' } } },
    ]),
    DailyExpense.aggregate<{ paid: number }>([
      { $match: { type: 'MANO_OBRA', date: { $gte: start, $lte: end } } },
      { $group: { _id: null, paid: { $sum: '$amount' } } },
    ]),
    loadActiveWorkers(),
  ]);

  const customers = buildCustomerBaseline({ orders: orderRows[0]?.orders ?? 0, units: orderRows[0]?.units ?? 0 });
  const overhead = mergeOverheadSuggestion(
    (params?.overheadItems ?? []).map((i) => ({ concept: i.concept, monthlyCost: i.monthlyCost })),
    gifRows.filter((r) => r._id).map((r) => ({ concept: r._id, paid: r.paid }))
  );
  const labor = resolveLabor(
    {
      hourlyWage: params?.hourlyWage ?? 0,
      numberOfWorkers: params?.numberOfWorkers ?? 1,
      hoursPerDay: params?.hoursPerDay ?? 8,
      numberOfShifts: params?.numberOfShifts ?? 1,
      monthlyCustomers: params?.monthlyCustomers ?? 1,
      productsPerCustomer: params?.productsPerCustomer ?? 1,
    },
    workers
  );

  return {
    month,
    label: monthLabel(month),
    customers: {
      ...customers,
      current: { monthlyCustomers: params?.monthlyCustomers ?? 1, productsPerCustomer: params?.productsPerCustomer ?? 1 },
    },
    overhead,
    // Informativo: lo planificado con los trabajadores vs. lo realmente pagado en Gastos ese mes.
    labor: { mode: labor.mode, workersCount: labor.workersCount, plannedMonthly: labor.monthlyLabor, paidInMonth: laborRows[0]?.paid ?? 0 },
  };
}
