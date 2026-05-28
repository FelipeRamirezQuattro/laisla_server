import { Request, Response } from 'express';
import Client from '../models/Client';

function getPagination(query: Record<string, string | string[] | undefined>) {
  const page = parseInt(String(query.page || '1'), 10);
  const limit = parseInt(String(query.limit || '20'), 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export async function getClients(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, string>);
    const { search } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [clients, total] = await Promise.all([
      Client.find(filter).skip(skip).limit(limit).sort({ name: 1 }),
      Client.countDocuments(filter),
    ]);

    res.json({ clients, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
}

export async function getClient(req: Request, res: Response): Promise<void> {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) { res.status(404).json({ error: 'Cliente no encontrado' }); return; }
    res.json(client);
  } catch {
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
}

export async function createClient(req: Request, res: Response): Promise<void> {
  try {
    const client = await Client.create(req.body);
    res.status(201).json(client);
  } catch {
    res.status(500).json({ error: 'Error al crear cliente' });
  }
}

export async function updateClient(req: Request, res: Response): Promise<void> {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!client) { res.status(404).json({ error: 'Cliente no encontrado' }); return; }
    res.json(client);
  } catch {
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
}

export async function deleteClient(req: Request, res: Response): Promise<void> {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) { res.status(404).json({ error: 'Cliente no encontrado' }); return; }
    res.json({ message: 'Cliente eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
}
