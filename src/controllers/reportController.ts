import { Request, Response } from 'express';
import Order from '../models/Order';
import { localStartOfDay, localEndOfDay, TZ } from '../utils/timezone';
import { formatInTimeZone } from 'date-fns-tz';

export async function getSalesReport(req: Request, res: Response): Promise<void> {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string>;

    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.$gte = localStartOfDay(new Date(dateFrom));
    if (dateTo) dateFilter.$lte = localEndOfDay(new Date(dateTo));

    const matchStage: Record<string, unknown> = {
      $or: [
        { status: 'billed' },
        { status: 'delivered', paymentMethod: { $ne: null }, closedAt: { $ne: null } },
      ],
    };
    if (dateFrom || dateTo) matchStage.closedAt = dateFilter;

    const orders = await Order.find(matchStage).populate('items.productId', 'category');

    // Revenue by payment method
    const revenueByMethod = { cash: 0, card: 0, transfer: 0 };
    let totalRevenue = 0;

    orders.forEach((order) => {
      totalRevenue += order.total;
      if (order.paymentMethod === 'cash') revenueByMethod.cash += order.total;
      else if (order.paymentMethod === 'card') revenueByMethod.card += order.total;
      else if (order.paymentMethod === 'transfer') revenueByMethod.transfer += order.total;
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
      dailyRevenue,
    });
  } catch {
    res.status(500).json({ error: 'Error al generar reporte de ventas' });
  }
}

export async function getProductsReport(req: Request, res: Response): Promise<void> {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string>;

    const matchStage: Record<string, unknown> = {
      $or: [
        { status: 'billed' },
        { status: 'delivered', paymentMethod: { $ne: null }, closedAt: { $ne: null } },
      ],
    };
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.$gte = localStartOfDay(new Date(dateFrom));
      if (dateTo) dateFilter.$lte = localEndOfDay(new Date(dateTo));
      matchStage.closedAt = dateFilter;
    }

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
