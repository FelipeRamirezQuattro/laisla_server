import { getOrderPayments } from '../utils/orderPayments';
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
    const query = req.query as Record<string, string | undefined>;
    // `date` is kept as a single-day shorthand; dateFrom/dateTo define a range (default: today).
    const from = query.dateFrom || query.date || '';
    const to = query.dateTo || query.date || from;
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      res.status(400).json({ error: 'Fecha inválida' });
      return;
    }
    if (from && to && from > to) {
      res.status(400).json({ error: 'La fecha inicial no puede ser posterior a la final' });
      return;
    }
    const start = localStartOfDay(from ? parseLocalDateInput(from) : now);
    const end = localEndOfDay(to ? parseLocalDateInput(to) : now);

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

    // Hourly sales (summed across the range when it spans several days)
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

    // Se reparte en memoria (no con $group) para que un pedido con pago
    // dividido cuente una sola vez en `orders` y su monto se asigne a cada método.
    const monthOrders = await Order.find(getBilledOrderMatch({ start, end }))
      .select('closedAt total paymentMethod payments')
      .lean();

    // Current month: only list days up to today; past months list every day.
    const currentMonth = formatInTimeZone(new Date(), TZ, 'yyyy-MM');
    const lastShownDay = month === currentMonth ? Number(formatInTimeZone(new Date(), TZ, 'd')) : lastDay;

    const days = Array.from({ length: lastShownDay }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, '0')}`;
      const day = { date, revenue: 0, orders: 0, cash: 0, card: 0, transfer: 0, nequi: 0 };
      for (const order of monthOrders) {
        if (!order.closedAt || formatInTimeZone(order.closedAt, TZ, 'yyyy-MM-dd') !== date) continue;
        day.revenue += order.total;
        day.orders += 1;
        for (const { method, amount } of getOrderPayments(order)) day[method] += amount;
      }
      return day;
    });

    res.json({ month, days });
  } catch {
    res.status(500).json({ error: 'Error al obtener ventas del mes' });
  }
}
