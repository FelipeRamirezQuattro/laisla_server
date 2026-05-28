import { Request, Response } from 'express';
import Table from '../models/Table';
import TableZone, { DEFAULT_TABLE_ZONES } from '../models/TableZone';
import Order from '../models/Order';
import Reservation from '../models/Reservation';
import { localEndOfDay, localStartOfDay, parseLocalDateInput } from '../utils/timezone';

function zoneValueFromLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureDefaultTableZones() {
  const count = await TableZone.countDocuments();
  if (count > 0) return;
  await TableZone.insertMany(DEFAULT_TABLE_ZONES);
}

export async function getTableZones(_req: Request, res: Response): Promise<void> {
  try {
    await ensureDefaultTableZones();
    const zones = await TableZone.find().sort({ orden: 1, label: 1 });
    res.json(zones);
  } catch {
    res.status(500).json({ error: 'Error al obtener zonas' });
  }
}

export async function createTableZone(req: Request, res: Response): Promise<void> {
  try {
    const label = String(req.body.label || '').trim();
    if (!label) { res.status(422).json({ error: 'Nombre requerido' }); return; }

    const value = zoneValueFromLabel(label);
    if (!value) { res.status(422).json({ error: 'Nombre inválido' }); return; }

    const exists = await TableZone.findOne({ value });
    if (exists) { res.status(409).json({ error: 'Ya existe una zona con ese nombre' }); return; }

    const last = await TableZone.findOne().sort({ orden: -1 });
    const zone = await TableZone.create({
      value,
      label,
      orden: (last?.orden || 0) + 1,
    });
    res.status(201).json(zone);
  } catch {
    res.status(500).json({ error: 'Error al crear zona' });
  }
}

export async function updateTableZone(req: Request, res: Response): Promise<void> {
  try {
    const label = String(req.body.label || '').trim();
    if (!label) { res.status(422).json({ error: 'Nombre requerido' }); return; }

    const zone = await TableZone.findById(req.params.id);
    if (!zone) { res.status(404).json({ error: 'Zona no encontrada' }); return; }

    const oldValue = zone.value;
    const value = zoneValueFromLabel(label);
    if (!value) { res.status(422).json({ error: 'Nombre inválido' }); return; }

    const duplicate = await TableZone.findOne({ value, _id: { $ne: zone._id } });
    if (duplicate) { res.status(409).json({ error: 'Ya existe una zona con ese nombre' }); return; }

    zone.label = label;
    zone.value = value;
    await zone.save();

    if (oldValue !== value) {
      await Table.updateMany({ zone: oldValue }, { zone: value });
    }

    res.json(zone);
  } catch {
    res.status(500).json({ error: 'Error al actualizar zona' });
  }
}

export async function getTables(req: Request, res: Response): Promise<void> {
  try {
    const { zone, status, date } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (zone) filter.zone = zone;
    if (status) filter.status = status;
    const tables = await Table.find(filter).sort({ name: 1 }).lean();
    if (!date) {
      res.json(tables);
      return;
    }

    const targetDate = parseLocalDateInput(date);
    const start = localStartOfDay(targetDate);
    const end = localEndOfDay(targetDate);
    const [orders, reservations] = await Promise.all([
      Order.find({
        tableId: { $ne: null },
        status: { $nin: ['billed', 'cancelled'] },
        $or: [
          { serviceDate: { $gte: start, $lte: end } },
          { serviceDate: { $exists: false }, createdAt: { $gte: start, $lte: end } },
        ],
      }).select('_id tableId').lean(),
      Reservation.find({
        tableId: { $ne: null },
        status: { $in: ['pending', 'confirmed'] },
        date: { $gte: start, $lte: end },
      }).select('_id tableId').lean(),
    ]);

    const activeByTable = new Map(orders.map((order) => [String(order.tableId), order._id]));
    const reserved = new Set(reservations.map((reservation) => String(reservation.tableId)));
    res.json(tables.map((table) => {
      const activeOrderId = activeByTable.get(String(table._id));
      return {
        ...table,
        status: activeOrderId ? 'occupied' : reserved.has(String(table._id)) ? 'reserved' : table.status === 'reserved' ? 'reserved' : 'available',
        currentOrderId: activeOrderId ?? null,
      };
    }));
  } catch {
    res.status(500).json({ error: 'Error al obtener mesas' });
  }
}

export async function getTable(req: Request, res: Response): Promise<void> {
  try {
    const table = await Table.findById(req.params.id).populate('currentOrderId');
    if (!table) { res.status(404).json({ error: 'Mesa no encontrada' }); return; }
    res.json(table);
  } catch {
    res.status(500).json({ error: 'Error al obtener mesa' });
  }
}

export async function createTable(req: Request, res: Response): Promise<void> {
  try {
    const table = await Table.create(req.body);
    res.status(201).json(table);
  } catch {
    res.status(500).json({ error: 'Error al crear mesa' });
  }
}

export async function updateTable(req: Request, res: Response): Promise<void> {
  try {
    const table = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!table) { res.status(404).json({ error: 'Mesa no encontrada' }); return; }
    res.json(table);
  } catch {
    res.status(500).json({ error: 'Error al actualizar mesa' });
  }
}

export async function deleteTable(req: Request, res: Response): Promise<void> {
  try {
    const table = await Table.findByIdAndDelete(req.params.id);
    if (!table) { res.status(404).json({ error: 'Mesa no encontrada' }); return; }
    res.json({ message: 'Mesa eliminada' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar mesa' });
  }
}

export async function releaseTable(req: Request, res: Response): Promise<void> {
  try {
    await Order.updateMany(
      {
        tableId: req.params.id,
        status: { $nin: ['billed', 'cancelled'] },
      },
      { tableId: null, orderType: 'walk-in' }
    );
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { status: 'available', currentOrderId: null },
      { new: true }
    );
    if (!table) { res.status(404).json({ error: 'Mesa no encontrada' }); return; }
    res.json(table);
  } catch {
    res.status(500).json({ error: 'Error al liberar mesa' });
  }
}

export async function releaseAllTables(_req: Request, res: Response): Promise<void> {
  try {
    await Order.updateMany(
      {
        tableId: { $ne: null },
        status: { $nin: ['billed', 'cancelled'] },
      },
      { tableId: null, orderType: 'walk-in' }
    );
    const result = await Table.updateMany({}, { status: 'available', currentOrderId: null });
    res.json({ released: result.modifiedCount });
  } catch {
    res.status(500).json({ error: 'Error al liberar mesas' });
  }
}
