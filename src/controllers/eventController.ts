import { Request, Response } from 'express';
import Event from '../models/Event';
import DinnerGuest from '../models/DinnerGuest';
import EventBooking from '../models/EventBooking';
import { generateGroups } from '../services/matchingService';
import { GuestForMatching } from '../types';

function getPagination(query: Record<string, string | string[] | undefined>) {
  const page = parseInt(String(query.page || '1'), 10);
  const limit = parseInt(String(query.limit || '20'), 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export async function getEvents(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, string>);
    const { type, status, isPublished } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

    const [events, total] = await Promise.all([
      Event.find(filter).skip(skip).limit(limit).sort({ date: 1 }),
      Event.countDocuments(filter),
    ]);

    res.json({ events, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
}

export async function getEvent(req: Request, res: Response): Promise<void> {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
    res.json(event);
  } catch {
    res.status(500).json({ error: 'Error al obtener evento' });
  }
}

export async function createEvent(req: Request, res: Response): Promise<void> {
  try {
    const event = await Event.create(req.body);
    res.status(201).json(event);
  } catch {
    res.status(500).json({ error: 'Error al crear evento' });
  }
}

export async function updateEvent(req: Request, res: Response): Promise<void> {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
    res.json(event);
  } catch {
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
}

export async function deleteEvent(req: Request, res: Response): Promise<void> {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
    res.json({ message: 'Evento eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
}

export async function generateEventGroups(req: Request, res: Response): Promise<void> {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

    if (event.type !== 'dinner-with-strangers') {
      res.status(400).json({ error: 'Solo se pueden generar grupos para eventos de Cena con Desconocidos' });
      return;
    }

    const guests = await DinnerGuest.find({ eventId: event._id, status: { $ne: 'cancelled' } });

    if (guests.length === 0) {
      res.status(400).json({ error: 'No hay invitados registrados para este evento' });
      return;
    }

    const guestsForMatching: GuestForMatching[] = guests.map((g) => ({
      _id: g._id.toString(),
      name: g.name,
      ageRange: g.ageRange,
      compatibilityProfile: g.compatibilityProfile,
    }));

    const groups = generateGroups(guestsForMatching);

    // Save groups to event and assign group number to each guest
    event.generatedGroups = groups.map((g) => ({
      groupNumber: g.groupNumber,
      guests: g.guests as unknown as import('mongoose').Types.ObjectId[],
    }));

    await event.save();

    // Update assignedGroup on each DinnerGuest
    await Promise.all(
      groups.flatMap((group) =>
        group.guests.map((guestId) =>
          DinnerGuest.findByIdAndUpdate(guestId, { assignedGroup: group.groupNumber })
        )
      )
    );

    // Return populated groups
    const populatedEvent = await Event.findById(event._id);
    const populatedGuests = await DinnerGuest.find({ eventId: event._id });

    res.json({ groups: populatedEvent?.generatedGroups, guests: populatedGuests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar grupos' });
  }
}

export async function getEventGuests(req: Request, res: Response): Promise<void> {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

    if (event.type === 'dinner-with-strangers') {
      const guests = await DinnerGuest.find({ eventId: req.params.id }).sort({ createdAt: -1 });
      res.json(guests);
      return;
    }

    const bookings = await EventBooking.find({ eventId: req.params.id }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch {
    res.status(500).json({ error: 'Error al obtener invitados' });
  }
}

export async function reassignGuestGroup(req: Request, res: Response): Promise<void> {
  try {
    const { guestId, groupNumber } = req.body;
    const guest = await DinnerGuest.findByIdAndUpdate(guestId, { assignedGroup: groupNumber }, { new: true });
    if (!guest) { res.status(404).json({ error: 'Invitado no encontrado' }); return; }
    res.json(guest);
  } catch {
    res.status(500).json({ error: 'Error al reasignar invitado' });
  }
}
