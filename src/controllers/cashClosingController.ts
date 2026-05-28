import { Request, Response } from 'express';
import CashClosing from '../models/CashClosing';
import DailyExpense from '../models/DailyExpense';
import Order from '../models/Order';
import { AuthRequest } from '../types';
import { localStartOfDay, localEndOfDay, parseLocalDateInput } from '../utils/timezone';

function parseTargetDate(date?: string): Date {
  return parseLocalDateInput(date);
}

async function getDayBillingSummary(date?: string) {
  const targetDate = parseTargetDate(date);
  const start = localStartOfDay(targetDate);
  const end = localEndOfDay(targetDate);

  const [invoicedOrders, openOrders, cancelledOrders, dailyExpenses] = await Promise.all([
    Order.find({
      $or: [
        { status: 'billed' },
        { status: 'delivered', paymentMethod: { $ne: null }, closedAt: { $ne: null } },
      ],
      closedAt: { $gte: start, $lte: end },
    }).lean(),
    Order.find({
      status: { $nin: ['billed', 'cancelled'] },
      $or: [
        { serviceDate: { $gte: start, $lte: end } },
        { serviceDate: { $exists: false }, createdAt: { $gte: start, $lte: end } },
      ],
    })
      .populate('tableId', 'name')
      .sort({ createdAt: 1 })
      .lean(),
    Order.find({
      status: 'cancelled',
      cancelledAt: { $gte: start, $lte: end },
    })
      .populate('tableId', 'name')
      .sort({ cancelledAt: 1 })
      .lean(),
    DailyExpense.find({
      date: { $gte: start, $lte: end },
    })
      .populate('insumoId', 'nombre unidad')
      .populate('providerId', 'name')
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  const cashSales = invoicedOrders
    .filter((o) => o.paymentMethod === 'cash')
    .reduce((sum, o) => sum + o.total, 0);

  const cardSales = invoicedOrders
    .filter((o) => o.paymentMethod === 'card')
    .reduce((sum, o) => sum + o.total, 0);

  const transferSales = invoicedOrders
    .filter((o) => o.paymentMethod === 'transfer')
    .reduce((sum, o) => sum + o.total, 0);

  return {
    cashSales,
    cardSales,
    transferSales,
    totalOrders: invoicedOrders.length,
    totalSales: cashSales + cardSales + transferSales,
    totalDailyExpenses: dailyExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    dailyExpenses,
    openOrdersCount: openOrders.length,
    openOrders: openOrders.map((order) => ({
      _id: order._id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      tableName: typeof order.tableId === 'object' && order.tableId && 'name' in order.tableId
        ? order.tableId.name
        : '',
      itemsCount: order.items.length,
    })),
    cancelledOrdersCount: cancelledOrders.length,
    cancelledOrders: cancelledOrders.map((order) => ({
      _id: order._id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      cancelReasonDetail: order.cancelReasonDetail,
      tableName: typeof order.tableId === 'object' && order.tableId && 'name' in order.tableId
        ? order.tableId.name
        : '',
      itemsCount: order.items.length,
    })),
  };
}

export async function getCashClosings(req: Request, res: Response): Promise<void> {
  try {
    const closings = await CashClosing.find()
      .populate('closedBy', 'name')
      .sort({ date: -1 })
      .limit(30);
    res.json(closings);
  } catch {
    res.status(500).json({ error: 'Error al obtener cierres de caja' });
  }
}

export async function getDailySales(req: Request, res: Response): Promise<void> {
  try {
    const { date } = req.query as { date?: string };
    res.json(await getDayBillingSummary(date));
  } catch {
    res.status(500).json({ error: 'Error al obtener ventas del día' });
  }
}

export async function createCashClosing(req: AuthRequest, res: Response): Promise<void> {
  try {
    const {
      date,
      openingCash,
      expenses,
      actualCash,
      notes,
    } = req.body;

    const sales = await getDayBillingSummary(date);
    const moduleExpenses = (sales.dailyExpenses || []).map((expense: any) => ({
      description: expense.description,
      amount: expense.amount,
      source: 'daily_expense',
      expenseId: expense._id,
    }));
    const manualExpenses = (expenses || []).map((expense: { description: string; amount: number }) => ({
      ...expense,
      source: 'manual',
    }));
    const closingExpenses = [...moduleExpenses, ...manualExpenses];
    const totalExpenses = (expenses || []).reduce(
      (sum: number, e: { amount: number }) => sum + e.amount,
      0
    ) + sales.totalDailyExpenses;
    const expectedCash = openingCash + sales.cashSales - totalExpenses;
    const difference = actualCash - expectedCash;

    const closing = await CashClosing.create({
      date,
      openingCash,
      cashSales: sales.cashSales,
      cardSales: sales.cardSales,
      transferSales: sales.transferSales,
      expenses: closingExpenses,
      totalExpenses,
      expectedCash,
      actualCash,
      difference,
      notes,
      closedBy: req.user!.id,
    });

    res.status(201).json(closing);
  } catch {
    res.status(500).json({ error: 'Error al crear cierre de caja' });
  }
}
