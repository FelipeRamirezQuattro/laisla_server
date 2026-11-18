import { Response } from 'express';
import { AuthRequest } from '../../types';
import Worker from '../models/Worker';

export const EDITABLE_WORKER_FIELDS = ['name', 'role', 'hourlyRate', 'hoursPerDay', 'daysPerMonth', 'active'] as const;

// Solo los campos que el usuario puede cambiar (nada de _id, createdAt, etc.).
export function pickEditableWorkerFields(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of EDITABLE_WORKER_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

function sendError(res: Response, err: unknown, fallback: string) {
  if (err instanceof Error && err.name === 'ValidationError') {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: fallback, details: String(err) });
}

export async function listWorkers(_req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await Worker.find().sort({ active: -1, name: 1 }));
  } catch (err) {
    sendError(res, err, 'Error al obtener los trabajadores');
  }
}

export async function createWorker(req: AuthRequest, res: Response): Promise<void> {
  try {
    const worker = await Worker.create(pickEditableWorkerFields(req.body));
    res.status(201).json(worker);
  } catch (err) {
    sendError(res, err, 'Error al crear el trabajador');
  }
}

export async function updateWorker(req: AuthRequest, res: Response): Promise<void> {
  try {
    const worker = await Worker.findByIdAndUpdate(req.params.id, pickEditableWorkerFields(req.body), {
      new: true,
      runValidators: true,
    });
    if (!worker) { res.status(404).json({ error: 'Trabajador no encontrado' }); return; }
    res.json(worker);
  } catch (err) {
    sendError(res, err, 'Error al actualizar el trabajador');
  }
}

// No se borra: sus pagos registrados en Gastos siguen apuntando a él. Solo deja de contar en el MOD.
export async function deactivateWorker(req: AuthRequest, res: Response): Promise<void> {
  try {
    const worker = await Worker.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!worker) { res.status(404).json({ error: 'Trabajador no encontrado' }); return; }
    res.json(worker);
  } catch (err) {
    sendError(res, err, 'Error al desactivar el trabajador');
  }
}
