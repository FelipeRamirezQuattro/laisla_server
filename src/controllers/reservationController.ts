import { Request, Response } from 'express';
import Reservation from '../models/Reservation';
import Table from '../models/Table';
import Order from '../models/Order';
import { sendReservationConfirmationEmail } from '../services/emailService';
import { localEndOfDay, localStartOfDay, parseLocalDateInput } from '../utils/timezone';

function getPagination(query: Record<string, string | string[] | undefined>) {
  const page = parseInt(String(query.page || '1'), 10);
  const limit = parseInt(String(query.limit || '20'), 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LI-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getReservations(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, string>);
    const { status, dateFrom, dateTo, type } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.$gte = localStartOfDay(parseLocalDateInput(dateFrom));
      if (dateTo) dateFilter.$lte = localEndOfDay(parseLocalDateInput(dateTo));
      filter.date = dateFilter;
    }
    if (type === 'event') {
      filter.eventId = { $exists: true, $ne: null };
    } else if (type === 'table') {
      filter.eventId = { $exists: false };
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(filter).populate('tableId', 'name zone capacity').skip(skip).limit(limit).sort({ date: -1 }),
      Reservation.countDocuments(filter),
    ]);

    res.json({ reservations, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Error al obtener reservaciones' });
  }
}

export async function createAdminReservation(req: Request, res: Response): Promise<void> {
  try {
    const tableId = req.body.tableId || null;
    const reservationDate = parseLocalDateInput(req.body.date);
    if (tableId) {
      const table = await Table.findById(tableId).lean();
      if (!table) { res.status(404).json({ error: 'Mesa no encontrada' }); return; }
      const start = localStartOfDay(reservationDate);
      const end = localEndOfDay(reservationDate);
      const [activeOrder, activeReservation] = await Promise.all([
        Order.findOne({
          tableId,
          status: { $nin: ['billed', 'cancelled'] },
          $or: [
            { serviceDate: { $gte: start, $lte: end } },
            { serviceDate: { $exists: false }, createdAt: { $gte: start, $lte: end } },
          ],
        }).lean(),
        Reservation.findOne({
          tableId,
          status: { $in: ['pending', 'confirmed'] },
          date: { $gte: start, $lte: end },
        }).lean(),
      ]);
      if (activeOrder || activeReservation) {
        res.status(409).json({ error: 'La mesa no está disponible para esa fecha' });
        return;
      }
    }

    let confirmationCode = generateConfirmationCode();
    let exists = await Reservation.findOne({ confirmationCode });
    while (exists) {
      confirmationCode = generateConfirmationCode();
      exists = await Reservation.findOne({ confirmationCode });
    }

    const reservation = await Reservation.create({
      clientName: req.body.clientName,
      email: req.body.email || 'reserva@laisla.local',
      phone: req.body.phone || 'N/A',
      date: reservationDate,
      timeSlot: req.body.timeSlot || '10:00',
      partySize: req.body.partySize || 1,
      tableId,
      detail: req.body.detail || '',
      zone: req.body.zone || 'social',
      specialOccasion: req.body.specialOccasion || { hasOccasion: false },
      confirmationCode,
      status: req.body.status || 'confirmed',
    });
    const populated = await Reservation.findById(reservation._id).populate('tableId', 'name zone capacity');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear reservación', details: String(err) });
  }
}

export async function getReservation(req: Request, res: Response): Promise<void> {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) { res.status(404).json({ error: 'Reservación no encontrada' }); return; }
    res.json(reservation);
  } catch {
    res.status(500).json({ error: 'Error al obtener reservación' });
  }
}

export async function createPublicReservation(req: Request, res: Response): Promise<void> {
  try {
    let confirmationCode = generateConfirmationCode();
    // Ensure uniqueness
    let exists = await Reservation.findOne({ confirmationCode });
    while (exists) {
      confirmationCode = generateConfirmationCode();
      exists = await Reservation.findOne({ confirmationCode });
    }

    const reservation = await Reservation.create({ ...req.body, confirmationCode });
    sendReservationConfirmationEmail(reservation).catch((error) => {
      console.error(`Error sending reservation confirmation ${reservation.confirmationCode}:`, error);
    });
    res.status(201).json(reservation);
  } catch {
    res.status(500).json({ error: 'Error al crear reservación' });
  }
}

async function tableIsAvailable(tableId: string, reservation: any): Promise<boolean> {
  const start = localStartOfDay(reservation.date);
  const end = localEndOfDay(reservation.date);
  const [activeOrder, activeReservation] = await Promise.all([
    Order.findOne({
      tableId,
      status: { $nin: ['billed', 'cancelled'] },
      $or: [
        { serviceDate: { $gte: start, $lte: end } },
        { serviceDate: { $exists: false }, createdAt: { $gte: start, $lte: end } },
      ],
    }).lean(),
    Reservation.findOne({
      _id: { $ne: reservation._id },
      tableId,
      status: { $in: ['pending', 'confirmed'] },
      date: { $gte: start, $lte: end },
    }).lean(),
  ]);
  return !activeOrder && !activeReservation;
}

export async function updateReservationStatus(req: Request, res: Response): Promise<void> {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) { res.status(404).json({ error: 'Reservación no encontrada' }); return; }

    const { status, tableId, detail } = req.body;
    if (detail !== undefined) reservation.detail = detail;

    if (tableId !== undefined) {
      if (tableId) {
        const table = await Table.findById(tableId).lean();
        if (!table) { res.status(404).json({ error: 'Mesa no encontrada' }); return; }
        if (!(await tableIsAvailable(tableId, reservation))) {
          res.status(409).json({ error: 'La mesa no está disponible para esa fecha' });
          return;
        }
        reservation.tableId = tableId;
      } else {
        reservation.tableId = undefined;
      }
    }

    if (status === 'confirmed' && !reservation.tableId) {
      res.status(400).json({ error: 'Debes asignar una mesa para confirmar la reserva' });
      return;
    }

    if (status) reservation.status = status;
    await reservation.save();
    const populated = await Reservation.findById(reservation._id).populate('tableId', 'name zone capacity');
    res.json(populated);
  } catch {
    res.status(500).json({ error: 'Error al actualizar reservación' });
  }
}

export async function deleteReservation(req: Request, res: Response): Promise<void> {
  try {
    const reservation = await Reservation.findByIdAndDelete(req.params.id);
    if (!reservation) { res.status(404).json({ error: 'Reservación no encontrada' }); return; }
    res.json({ message: 'Reservación eliminada' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar reservación' });
  }
}
