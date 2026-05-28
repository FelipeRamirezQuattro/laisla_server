import { Request, Response } from 'express';
import DinnerGuest from '../models/DinnerGuest';
import EventBooking from '../models/EventBooking';
import Event from '../models/Event';

export async function registerDinnerGuest(req: Request, res: Response): Promise<void> {
  try {
    const event = await Event.findById(req.body.eventId);
    if (!event) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

    if (event.currentRegistrations >= event.maxCapacity) {
      res.status(400).json({ error: 'El evento está lleno' });
      return;
    }

    const guest = await DinnerGuest.create(req.body);

    // Increment registration count
    await Event.findByIdAndUpdate(req.body.eventId, { $inc: { currentRegistrations: 1 } });

    res.status(201).json(guest);
  } catch {
    res.status(500).json({ error: 'Error al registrar invitado' });
  }
}

export async function bookEventSpot(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);
    if (!event) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

    if (!event.isPublished) {
      res.status(400).json({ error: 'Este evento no está disponible' });
      return;
    }

    const remainingSpots = event.maxCapacity - event.currentRegistrations;
    const { tickets = 1 } = req.body;

    if (tickets > remainingSpots) {
      res.status(400).json({ error: `Solo quedan ${remainingSpots} cupos disponibles` });
      return;
    }

    const booking = await EventBooking.create({
      eventId: id,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      tickets,
      notes: req.body.notes || '',
    });

    await Event.findByIdAndUpdate(id, { $inc: { currentRegistrations: tickets } });

    res.status(201).json({
      message: 'Registro exitoso',
      booking,
      event: { title: event.title, date: event.date, time: event.time },
    });
  } catch {
    res.status(500).json({ error: 'Error al reservar cupo' });
  }
}
