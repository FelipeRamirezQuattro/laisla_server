import { Response } from 'express';
import { DeviceRequest } from '../../types';
import Printer from '../models/Printer';
import PrintAgent from '../models/PrintAgent';
import { claimNextJobForAgent, reportJobResult } from '../services/PrintJobService';
import { localNow } from '../../utils/timezone';
import { env } from '../../config/env';

export async function claimPrintJob(req: DeviceRequest, res: Response): Promise<void> {
  try {
    const printers = await Printer.find({ agentId: req.device!.agentId, isActive: true }).select('_id');
    const job = await claimNextJobForAgent(printers.map((p) => p._id));
    if (!job) { res.status(204).end(); return; }
    res.json(job);
  } catch {
    res.status(500).json({ error: 'Error al reclamar el siguiente trabajo de impresión' });
  }
}

export async function reportPrintJobResult(req: DeviceRequest, res: Response): Promise<void> {
  try {
    const { success, error } = req.body as { success?: boolean; error?: string };
    const job = await reportJobResult(req.params.id, { success: Boolean(success), error }, env.PRINT_JOB_MAX_ATTEMPTS);
    if (!job) { res.status(404).json({ error: 'Trabajo de impresión no encontrado' }); return; }
    res.json(job);
  } catch {
    res.status(500).json({ error: 'Error al reportar el resultado del trabajo de impresión' });
  }
}

export async function heartbeat(req: DeviceRequest, res: Response): Promise<void> {
  try {
    await PrintAgent.findByIdAndUpdate(req.device!.agentId, { lastSeenAt: localNow() });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al registrar el heartbeat' });
  }
}
