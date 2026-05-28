import { Router } from 'express';
import Event from '../../models/Event';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { type } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {
      isPublished: true,
      date: { $gte: new Date() },
      status: { $nin: ['cancelled', 'completed'] },
    };
    if (type) filter.type = type;

    const events = await Event.find(filter).sort({ date: 1 });
    res.json(events);
  } catch {
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, isPublished: true });
    if (!event) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
    res.json(event);
  } catch {
    res.status(500).json({ error: 'Error al obtener evento' });
  }
});

export default router;
