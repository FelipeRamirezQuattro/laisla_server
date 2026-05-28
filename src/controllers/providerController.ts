import { Request, Response } from 'express';
import Provider from '../models/Provider';

function getPagination(query: Record<string, string | string[] | undefined>) {
  const page = parseInt(String(query.page || '1'), 10);
  const limit = parseInt(String(query.limit || '20'), 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export async function getProviders(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, string>);
    const { search } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (search) filter.name = { $regex: search, $options: 'i' };

    const [providers, total] = await Promise.all([
      Provider.find(filter).skip(skip).limit(limit).sort({ name: 1 }),
      Provider.countDocuments(filter),
    ]);

    res.json({ providers, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
}

export async function getProvider(req: Request, res: Response): Promise<void> {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }
    res.json(provider);
  } catch {
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
}

export async function createProvider(req: Request, res: Response): Promise<void> {
  try {
    const provider = await Provider.create(req.body);
    res.status(201).json(provider);
  } catch {
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
}

export async function updateProvider(req: Request, res: Response): Promise<void> {
  try {
    const provider = await Provider.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!provider) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }
    res.json(provider);
  } catch {
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
}

export async function deleteProvider(req: Request, res: Response): Promise<void> {
  try {
    const provider = await Provider.findByIdAndDelete(req.params.id);
    if (!provider) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }
    res.json({ message: 'Proveedor eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
}
