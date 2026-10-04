import { Response } from 'express';
import { AuthRequest } from '../../types';
import Printer from '../models/Printer';
import { createTestPrintJob } from '../services/PrintJobService';

export async function getPrinters(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { role, isActive } = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    const printers = await Printer.find(filter).sort({ role: 1, name: 1 });
    res.json(printers);
  } catch {
    res.status(500).json({ error: 'Error al obtener impresoras' });
  }
}

export async function createPrinter(req: AuthRequest, res: Response): Promise<void> {
  try {
    const printer = await Printer.create(req.body);
    res.status(201).json(printer);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la impresora', details: String(err) });
  }
}

export async function updatePrinter(req: AuthRequest, res: Response): Promise<void> {
  try {
    const printer = await Printer.findById(req.params.id);
    if (!printer) { res.status(404).json({ error: 'Impresora no encontrada' }); return; }
    Object.assign(printer, req.body);
    await printer.save();
    res.json(printer);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar la impresora', details: String(err) });
  }
}

export async function deletePrinter(req: AuthRequest, res: Response): Promise<void> {
  try {
    const printer = await Printer.findByIdAndDelete(req.params.id);
    if (!printer) { res.status(404).json({ error: 'Impresora no encontrada' }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al eliminar la impresora' });
  }
}

export async function testPrinter(req: AuthRequest, res: Response): Promise<void> {
  try {
    const printer = await Printer.findById(req.params.id);
    if (!printer) { res.status(404).json({ error: 'Impresora no encontrada' }); return; }
    const job = await createTestPrintJob(printer);
    res.status(201).json(job);
  } catch {
    res.status(500).json({ error: 'Error al crear el trabajo de impresión de prueba' });
  }
}
