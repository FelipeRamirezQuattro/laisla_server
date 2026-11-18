import { getOrderPayments } from '../utils/orderPayments';
import { Request, Response } from 'express';
import Order from '../models/Order';
import mongoose from 'mongoose';
import { localStartOfDay, localEndOfDay, parseLocalDateInput, TZ } from '../utils/timezone';
import { formatInTimeZone } from 'date-fns-tz';
import { getBilledOrderMatch } from '../utils/orderQueries';
import Recipe from '../costs/models/Recipe';
import { buildSalesTrends, listDates } from '../utils/salesTrends';
import { buildWeeklyRecipeReport, buildWeeks, windowStart, type TotalRow, type WeeklyRow } from '../utils/weeklyRecipeReport';

export async function getSalesReport(req: Request, res: Response): Promise<void> {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string>;

    const matchStage = getBilledOrderMatch({
      start: dateFrom ? localStartOfDay(new Date(dateFrom)) : undefined,
      end: dateTo ? localEndOfDay(new Date(dateTo)) : undefined,
    });

    const orders = await Order.find(matchStage).populate('items.productId', 'category');

    // Revenue by payment method
    const revenueByMethod = { cash: 0, card: 0, transfer: 0, nequi: 0 };
    let totalRevenue = 0;
    const complimentary = { units: 0, value: 0 };

    orders.forEach((order) => {
      totalRevenue += order.total;
      for (const item of order.items) {
        if (!item.complimentary) continue;
        complimentary.units += item.quantity;
        complimentary.value += item.quantity * (item.originalUnitPrice ?? 0);
      }
      for (const { method, amount } of getOrderPayments(order)) revenueByMethod[method] += amount;
    });

    // Revenue by day
    const revenueByDay: Record<string, number> = {};
    orders.forEach((order) => {
      const day = order.closedAt ? formatInTimeZone(order.closedAt, TZ, 'yyyy-MM-dd') : '';
      if (day) revenueByDay[day] = (revenueByDay[day] || 0) + order.total;
    });

    const dailyRevenue = Object.entries(revenueByDay)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      totalRevenue,
      totalOrders: orders.length,
      revenueByMethod,
      complimentary,
      dailyRevenue,
    });
  } catch {
    res.status(500).json({ error: 'Error al generar reporte de ventas' });
  }
}

export async function getProductsReport(req: Request, res: Response): Promise<void> {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string>;

    const matchStage = getBilledOrderMatch({
      start: dateFrom ? localStartOfDay(new Date(dateFrom)) : undefined,
      end: dateTo ? localEndOfDay(new Date(dateTo)) : undefined,
    });

    const result = await Order.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    // Revenue by category
    const categoryRevenue = await Order.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$product.category',
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
        },
      },
    ]);

    res.json({ topProducts: result, categoryRevenue });
  } catch {
    res.status(500).json({ error: 'Error al generar reporte de productos' });
  }
}

// Cada ítem vendido se resuelve a su receta: los de tipo 'recipe' ya apuntan a ella y los
// 'product' la tienen en Product.recipeId. Las cortesías se separan porque igual consumen inventario.
const RESOLVE_RECIPE_STAGES = [
  { $unwind: '$items' },
  { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: '_prod' } },
  {
    $addFields: {
      _recipeId: {
        $cond: [{ $eq: ['$items.productType', 'recipe'] }, '$items.productId', { $arrayElemAt: ['$_prod.recipeId', 0] }],
      },
    },
  },
];

const UNIT_SUMS = {
  sold: { $sum: { $cond: [{ $eq: ['$items.complimentary', true] }, 0, '$items.quantity'] } },
  complimentary: { $sum: { $cond: [{ $eq: ['$items.complimentary', true] }, '$items.quantity', 0] } },
};

export async function getRecipesWeeklyReport(req: Request, res: Response): Promise<void> {
  try {
    const requested = Number(req.query.weeks);
    const weeksCount = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 26) : 8;
    const now = new Date();
    const weeks = buildWeeks(now, weeksCount);

    const [weeklyRaw, totalsRaw] = await Promise.all([
      Order.aggregate([
        { $match: getBilledOrderMatch({ start: windowStart(now, weeksCount), end: now }) },
        ...RESOLVE_RECIPE_STAGES,
        {
          $group: {
            _id: {
              recipeId: '$_recipeId',
              year: { $isoWeekYear: { date: '$closedAt', timezone: TZ } },
              week: { $isoWeek: { date: '$closedAt', timezone: TZ } },
            },
            ...UNIT_SUMS,
          },
        },
      ]),
      Order.aggregate([
        { $match: getBilledOrderMatch() },
        ...RESOLVE_RECIPE_STAGES,
        { $group: { _id: '$_recipeId', ...UNIT_SUMS } },
      ]),
    ]);

    const rows: WeeklyRow[] = weeklyRaw.map((r) => ({
      recipeId: r._id.recipeId ? String(r._id.recipeId) : null,
      year: r._id.year,
      week: r._id.week,
      sold: r.sold,
      complimentary: r.complimentary,
    }));
    const totals: TotalRow[] = totalsRaw.map((r) => ({
      recipeId: r._id ? String(r._id) : null,
      sold: r.sold,
      complimentary: r.complimentary,
    }));

    const ids = [...new Set([...rows, ...totals].map((r) => r.recipeId).filter((id): id is string => !!id))];
    const recipeDocs = await Recipe.find({ _id: { $in: ids } }).select('name category').lean();
    const recipes = Object.fromEntries(
      recipeDocs.map((r) => [String(r._id), { name: r.name, category: r.category as string | undefined }])
    );

    res.json({
      weeks,
      recipes: buildWeeklyRecipeReport(weeks, rows, totals, recipes),
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar el reporte semanal de recetas', details: String(err) });
  }
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TREND_DAYS = 366;

// Tendencia de ventas por día de la semana, hora y fecha (opcionalmente de un solo producto).
// Cuenta unidades y valor vendidos; las cortesías no son ventas y se excluyen. Hora y día se
// calculan en hora de Colombia sobre `closedAt` (instante real de la facturación).
export async function getSalesTrendsReport(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query as Record<string, string | undefined>;
    const to = query.dateTo ?? formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    // Por defecto, las últimas 8 semanas: así cada día de la semana aparece 8 veces.
    const from = query.dateFrom ?? new Date(Date.parse(`${to}T00:00:00Z`) - 55 * 86_400_000).toISOString().slice(0, 10);
    if (!YMD.test(from) || !YMD.test(to)) { res.status(400).json({ error: 'Fecha inválida' }); return; }
    if (from > to) { res.status(400).json({ error: 'La fecha inicial no puede ser posterior a la final' }); return; }
    if (listDates(from, to).length > MAX_TREND_DAYS) { res.status(400).json({ error: 'El rango máximo es de 366 días' }); return; }
    if (query.productId && !mongoose.isValidObjectId(query.productId)) { res.status(400).json({ error: 'Producto inválido' }); return; }

    const start = localStartOfDay(parseLocalDateInput(from));
    const end = localEndOfDay(parseLocalDateInput(to));
    const baseStages = [
      { $match: getBilledOrderMatch({ start, end }) },
      { $unwind: '$items' },
      { $match: { 'items.complimentary': { $ne: true } } },
    ];
    const productStage = query.productId
      ? [{ $match: { 'items.productId': new mongoose.Types.ObjectId(query.productId) } }]
      : [];
    const sums = {
      units: { $sum: '$items.quantity' },
      revenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
    };

    const [facets, productRows] = await Promise.all([
      Order.aggregate([
        ...baseStages,
        ...productStage,
        {
          $facet: {
            heat: [
              {
                $group: {
                  _id: {
                    dow: { $isoDayOfWeek: { date: '$closedAt', timezone: TZ } },
                    hour: { $hour: { date: '$closedAt', timezone: TZ } },
                  },
                  ...sums,
                },
              },
            ],
            daily: [
              { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$closedAt', timezone: TZ } }, ...sums } },
            ],
          },
        },
      ]),
      // La lista de productos no se filtra por producto: alimenta el selector del reporte.
      Order.aggregate([
        ...baseStages,
        { $group: { _id: '$items.productId', name: { $first: '$items.productName' }, ...sums } },
        { $sort: { units: -1 } },
        { $limit: 100 },
      ]),
    ]);

    const trends = buildSalesTrends({
      from,
      to,
      heat: (facets[0]?.heat ?? []).map((r: any) => ({ dow: r._id.dow, hour: r._id.hour, units: r.units, revenue: r.revenue })),
      daily: (facets[0]?.daily ?? []).map((r: any) => ({ date: r._id, units: r.units, revenue: r.revenue })),
    });

    res.json({
      ...trends,
      productId: query.productId ?? null,
      products: productRows.map((r) => ({ productId: String(r._id), name: r.name, units: r.units, revenue: r.revenue })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar la tendencia de ventas', details: String(err) });
  }
}
