import { Request, Response } from 'express';
import Order from '../models/Order';
import Table from '../models/Table';
import Event from '../models/Event';
import { localStartOfDay, localEndOfDay, TZ } from '../utils/timezone';

export async function getDashboardSummary(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const start = localStartOfDay(now);
    const end = localEndOfDay(now);

    const [todayOrders, openTables, upcomingEvents, todaySalesResult] = await Promise.all([
      Order.countDocuments({
        createdAt: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' },
      }),
      Table.countDocuments({ status: { $in: ['occupied', 'reserved'] } }),
      Event.find({
        isPublished: true,
        date: { $gte: now },
        status: 'upcoming',
      })
        .sort({ date: 1 })
        .limit(3)
        .select('title date time type pricePerPerson'),
      Order.aggregate([
        {
          $match: {
            $or: [
              { status: 'billed' },
              { status: 'delivered', paymentMethod: { $ne: null }, closedAt: { $ne: null } },
            ],
            closedAt: { $gte: start, $lte: end },
          },
        },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);

    // Hourly sales for today
    const hourlySales = await Order.aggregate([
      {
        $match: {
          $or: [
            { status: 'billed' },
            { status: 'delivered', paymentMethod: { $ne: null }, closedAt: { $ne: null } },
          ],
          closedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $hour: { date: '$closedAt', timezone: TZ } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id': 1 } },
    ]);

    const hourlyData = Array.from({ length: 24 }, (_, h) => {
      const found = hourlySales.find((s) => s._id === h);
      return { hour: `${String(h).padStart(2, '0')}:00`, revenue: found?.revenue || 0, orders: found?.orders || 0 };
    });

    res.json({
      todaySales: todaySalesResult[0]?.total || 0,
      todayOrders,
      openTables,
      upcomingEvents,
      hourlySales: hourlyData,
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener resumen del dashboard' });
  }
}
