import { Response } from 'express';
import { AuthRequest } from '../../types';
import PrintJob from '../models/PrintJob';
import Printer from '../models/Printer';
import PrintAgent from '../models/PrintAgent';
import Order from '../../models/Order';
import FiscalDocument from '../../fiscal/models/FiscalDocument';
import { createReprintJob, retryPrintJob as retryPrintJobService } from '../services/PrintJobService';
import { localNow } from '../../utils/timezone';

const AGENT_OFFLINE_MINUTES = 2;

function getPagination(query: Record<string, string | string[] | undefined>) {
  const page = parseInt(String(query.page || '1'), 10);
  const limit = parseInt(String(query.limit || '20'), 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export async function listPrintJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, type, orderId } = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (orderId) filter.orderId = orderId;

    const { page, limit, skip } = getPagination(req.query as Record<string, string | undefined>);
    const [jobs, total] = await Promise.all([
      PrintJob.find(filter).populate('printerId', 'name role').sort({ createdAt: -1 }).skip(skip).limit(limit),
      PrintJob.countDocuments(filter),
    ]);

    res.json({ jobs, total, page, limit });
  } catch {
    res.status(500).json({ error: 'Error al listar trabajos de impresión' });
  }
}

export async function retryPrintJobHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const job = await retryPrintJobService(req.params.id);
    if (!job) { res.status(404).json({ error: 'Trabajo de impresión no encontrado' }); return; }
    res.json(job);
  } catch {
    res.status(500).json({ error: 'Error al reintentar el trabajo de impresión' });
  }
}

export async function reprintOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
    if (order.status !== 'billed') {
      res.status(400).json({ error: 'Solo se puede reimprimir el ticket de un pedido facturado' });
      return;
    }

    const { amountReceived } = req.body as { amountReceived?: number };
    const fiscalDocument = await FiscalDocument.findOne({
      orderId: order._id,
      type: { $in: ['DEE_POS', 'INVOICE'] },
    });
    const job = await createReprintJob(order, fiscalDocument, amountReceived);
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: 'Error al reimprimir el ticket', details: String(err) });
  }
}

export async function getPrintingAlerts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const offlineCutoff = new Date(localNow().getTime() - AGENT_OFFLINE_MINUTES * 60 * 1000);

    const [failedJobsCount, activeCajaPrinter, hasActiveAgent, staleActiveAgentsCount] = await Promise.all([
      PrintJob.countDocuments({ status: 'FAILED' }),
      Printer.findOne({ role: 'CAJA', isActive: true }),
      PrintAgent.exists({ isActive: true }),
      PrintAgent.countDocuments({
        isActive: true,
        $or: [{ lastSeenAt: { $lte: offlineCutoff } }, { lastSeenAt: null }],
      }),
    ]);

    res.json({
      failedJobsCount,
      noCajaPrinter: !activeCajaPrinter,
      agentsOffline: hasActiveAgent ? staleActiveAgentsCount > 0 : false,
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener las alertas de impresión' });
  }
}
