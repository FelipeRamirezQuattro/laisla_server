import { Request, Response } from 'express';
import { formatInTimeZone } from 'date-fns-tz';
import Order from '../models/Order';
import Table from '../models/Table';
import Event from '../models/Event';
import { localStartOfDay, localEndOfDay, parseLocalDateInput, TZ } from '../utils/timezone';
import { getBilledOrderMatch } from '../utils/orderQueries';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function getDashboardSummary(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const dateParam = typeof req.query.date === 'string' ? req.query.date : '';
    if (dateParam && !DATE_RE.test(dateParam)) {
      res.status(400).json({ error: 'Fecha inválida' });
      return;
    }
    const day = dateParam ? parseLocalDateInput(dateParam) : now;
    const start = localStartOfDay(day);
    const end = localEndOfDay(day);

    const [todayOrders, openTables, upcomingEvents, todaySalesResult] = await Promise.all([
      Order.countDocuments(getBilledOrderMatch({ start, end })),
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
        { $match: getBilledOrderMatch({ start, end }) },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);

    // Hourly sales for today
    const hourlySales = await Order.aggregate([
      { $match: getBilledOrderMatch({ start, end }) },
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

export async function getMonthlySales(req: Request, res: Response): Promise<void> {
  try {
    const monthParam = typeof req.query.month === 'string' ? req.query.month : '';
    if (monthParam && !MONTH_RE.test(monthParam)) {
      res.status(400).json({ error: 'Mes inválido' });
      return;
    }
    const month = monthParam || formatInTimeZone(new Date(), TZ, 'yyyy-MM');
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const start = localStartOfDay(parseLocalDateInput(`${month}-01`));
    const end = localEndOfDay(parseLocalDateInput(`${month}-${String(lastDay).padStart(2, '0')}`));

    const sales = await Order.aggregate([
      { $match: getBilledOrderMatch({ start, end }) },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$closedAt', timezone: TZ } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
    ]);

    const days = Array.from({ length: lastDay }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, '0')}`;
      const found = sales.find((sale) => sale._id === date);
      return { date, revenue: found?.revenue || 0, orders: found?.orders || 0 };
    });

    res.json({ month, days });
  } catch {
    res.status(500).json({ error: 'Error al obtener ventas del mes' });
  }
}
