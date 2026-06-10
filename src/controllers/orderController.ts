import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order';
import Table from '../models/Table';
import { AuthRequest } from '../types';
import { deductFromOrder } from '../costs/services/InventoryDeductionService';
import { localStartOfDay, localEndOfDay, parseLocalDateInput } from '../utils/timezone';

function getPagination(query: Record<string, string | string[] | undefined>) {
  const page = parseInt(String(query.page || '1'), 10);
  const limit = parseInt(String(query.limit || '20'), 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function calcTotal(items: Array<{ quantity: number; unitPrice: number }>) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function pushStatus(order: any, status: string, by?: string, notes = '') {
  const last = order.statusHistory?.[order.statusHistory.length - 1];
  if (last?.status === status) return;
  order.statusHistory.push({
    status,
    at: new Date(),
    by: by ? new mongoose.Types.ObjectId(by) : undefined,
    notes,
  });
}

function applyOrderDateFilter(filter: Record<string, unknown>, dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return;
  const serviceDateFilter: Record<string, Date> = {};
  const createdAtFilter: Record<string, Date> = {};
  if (dateFrom) {
    serviceDateFilter.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    createdAtFilter.$gte = localStartOfDay(parseLocalDateInput(dateFrom));
  }
  if (dateTo) {
    serviceDateFilter.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    createdAtFilter.$lte = localEndOfDay(parseLocalDateInput(dateTo));
  }
  filter.$or = [
    { serviceDate: serviceDateFilter },
    { serviceDate: { $exists: false }, createdAt: createdAtFilter },
  ];
}

export async function getOrders(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, string>);
    const { status, tableId, dateFrom, dateTo } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (status === 'open') filter.status = { $nin: ['billed', 'cancelled'] };
    else if (status) filter.status = status;
    if (tableId) filter.tableId = tableId;
    applyOrderDateFilter(filter, dateFrom, dateTo);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('tableId', 'name zone')
        .populate('clientId', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Order.countDocuments(filter),
    ]);

    res.json({ orders, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  try {
    const order = await Order.findById(req.params.id)
      .populate('tableId')
      .populate('clientId');
    if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
    res.json(order);
  } catch {
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
}

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { tableId, clientId, items, notes, serviceDate } = req.body;
    const subtotal = calcTotal(items);
    const isWalkIn = !tableId || tableId === 'walk-in';

    const order = await Order.create({
      tableId: isWalkIn ? null : tableId,
      orderType: isWalkIn ? 'walk-in' : 'table',
      clientId: clientId || null,
      items,
      subtotal,
      total: subtotal,
      notes,
      createdBy: req.user!.id,
      serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
      statusHistory: [{ status: 'pending', at: new Date(), by: req.user!.id }],
    });

    if (!isWalkIn) {
      await Table.findByIdAndUpdate(tableId, { status: 'occupied', currentOrderId: order._id });
    }

    res.status(201).json(order);
  } catch {
    res.status(500).json({ error: 'Error al crear pedido' });
  }
}

export async function updateOrder(req: Request, res: Response): Promise<void> {
  try {
    const { tableId, items, status, notes, serviceDate } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }

    if (items) {
      const subtotal = calcTotal(items);
      order.items = items;
      order.subtotal = subtotal;
      order.total = subtotal;
    }
    if (status !== undefined && status !== order.status) {
      order.status = status;
      pushStatus(order, status);
    }
    if (notes !== undefined) order.notes = notes;
    if (serviceDate !== undefined) order.serviceDate = new Date(serviceDate);

    if (tableId !== undefined && String(tableId || '') !== String(order.tableId || '')) {
      if (order.tableId) await Table.findByIdAndUpdate(order.tableId, { currentOrderId: null });
      const isWalkIn = !tableId || tableId === 'walk-in';
      if (!isWalkIn) await Table.findByIdAndUpdate(tableId, { status: 'occupied', currentOrderId: order._id });
      order.tableId = isWalkIn ? undefined : tableId;
      order.orderType = isWalkIn ? 'walk-in' : 'table';
    }

    await order.save();
    res.json(order);
  } catch {
    res.status(500).json({ error: 'Error al actualizar pedido' });
  }
}

export async function closeOrder(req: Request, res: Response): Promise<void> {
  try {
    const { paymentMethod } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
    if (order.status === 'cancelled') { res.status(400).json({ error: 'No se puede facturar un pedido cancelado' }); return; }
    if (order.status !== 'delivered') { res.status(400).json({ error: 'El pedido debe estar entregado antes de facturar' }); return; }

    order.status = 'billed';
    order.paymentMethod = paymentMethod;
    order.billedAt = new Date();
    order.closedAt = order.billedAt;
    pushStatus(order, 'billed', undefined, `Pago: ${paymentMethod}`);
    await order.save();

    if (order.tableId) {
      await Table.findByIdAndUpdate(order.tableId, { status: 'available', currentOrderId: null });
    }

    if (!order.inventoryDeductedAt) {
      await deductFromOrder(order._id as any, order.items);
      order.inventoryDeductedAt = new Date();
      await order.save();
    }

    res.json(order);
  } catch {
    res.status(500).json({ error: 'Error al cerrar pedido' });
  }
}

export async function deliverOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
    if (['billed', 'cancelled'].includes(order.status)) {
      res.status(400).json({ error: 'El pedido no se puede marcar como entregado' });
      return;
    }

    order.status = 'delivered';
    order.deliveredAt = new Date();
    pushStatus(order, 'delivered', req.user!.id);
    await order.save();

    res.json(order);
  } catch {
    res.status(500).json({ error: 'Error al entregar pedido' });
  }
}

export async function cancelOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { reason, reasonDetail } = req.body as { reason?: string; reasonDetail?: string };
    if (!reason) { res.status(400).json({ error: 'La razón de eliminación es requerida' }); return; }

    const order = await Order.findById(req.params.id);
    if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
    if (order.status === 'billed') { res.status(400).json({ error: 'No se puede eliminar un pedido facturado' }); return; }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.closedAt = order.closedAt ?? order.cancelledAt;
    order.cancelReason = reason;
    order.cancelReasonDetail = reasonDetail ?? '';
    pushStatus(order, 'cancelled', req.user!.id, reasonDetail ? `${reason}: ${reasonDetail}` : reason);
    await order.save();

    if (order.tableId) {
      await Table.findByIdAndUpdate(order.tableId, { status: 'available', currentOrderId: null });
    }

    res.json(order);
  } catch {
    res.status(500).json({ error: 'Error al cancelar pedido' });
  }
}

export async function getOrderTimingStats(req: Request, res: Response): Promise<void> {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {
      deliveredAt: { $ne: null },
    };
    applyOrderDateFilter(filter, dateFrom, dateTo);

    const orders = await Order.find(filter).lean();
    const delivered = orders.filter((order) => order.deliveredAt);
    const billed = orders.filter((order) => order.deliveredAt && order.billedAt);

    const deliveryMinutes = delivered.map((order) =>
      (new Date(order.deliveredAt as Date).getTime() - new Date(order.createdAt).getTime()) / 60000
    );
    const stayMinutes = billed.map((order) =>
      (new Date(order.billedAt as Date).getTime() - new Date(order.createdAt).getTime()) / 60000
    );

    const avg = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

    res.json({
      avgDeliveryMinutes: avg(deliveryMinutes),
      avgStayMinutes: avg(stayMinutes),
      deliveredCount: delivered.length,
      billedCount: billed.length,
      points: delivered.map((order) => ({
        orderId: order._id,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        billedAt: order.billedAt,
        deliveryMinutes: order.deliveredAt
          ? (new Date(order.deliveredAt).getTime() - new Date(order.createdAt).getTime()) / 60000
          : null,
        stayMinutes: order.billedAt
          ? (new Date(order.billedAt).getTime() - new Date(order.createdAt).getTime()) / 60000
          : null,
        total: order.total,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener métricas de pedidos' });
  }
}
