import { Response } from 'express';
import { AuthRequest } from '../../types';
import Order from '../../models/Order';
import FiscalConfig from '../models/FiscalConfig';
import FiscalDocument from '../models/FiscalDocument';
import { getProvider } from '../providers/getProvider';

const RETRYABLE_STATUSES = ['ERROR', 'CONTINGENCY', 'REJECTED'];

function getPagination(query: Record<string, string | string[] | undefined>) {
  const page = parseInt(String(query.page || '1'), 10);
  const limit = parseInt(String(query.limit || '20'), 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export async function getConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    let config = await FiscalConfig.findOne();
    if (!config) config = await FiscalConfig.create({});
    res.json(config);
  } catch {
    res.status(500).json({ error: 'Error al obtener la configuración fiscal' });
  }
}

export async function updateConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    let config = await FiscalConfig.findOne();
    if (!config) config = new FiscalConfig();
    Object.assign(config, req.body);
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar la configuración fiscal', details: String(err) });
  }
}

export async function listDocuments(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, type, orderId } = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (orderId) filter.orderId = orderId;

    const { page, limit, skip } = getPagination(req.query as Record<string, string | undefined>);
    const [documents, total] = await Promise.all([
      FiscalDocument.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      FiscalDocument.countDocuments(filter),
    ]);

    res.json({ documents, total, page, limit });
  } catch {
    res.status(500).json({ error: 'Error al listar documentos fiscales' });
  }
}

export async function getDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    const document = await FiscalDocument.findById(req.params.id);
    if (!document) { res.status(404).json({ error: 'Documento fiscal no encontrado' }); return; }
    res.json(document);
  } catch {
    res.status(500).json({ error: 'Error al obtener el documento fiscal' });
  }
}

export async function retryDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    const document = await FiscalDocument.findById(req.params.id);
    if (!document) { res.status(404).json({ error: 'Documento fiscal no encontrado' }); return; }
    if (!RETRYABLE_STATUSES.includes(document.status)) {
      res.status(400).json({ error: `No se puede reintentar un documento en estado ${document.status}` });
      return;
    }

    document.status = 'PENDING';
    document.attempts = 0;
    document.nextAttemptAt = undefined;
    document.lastError = '';
    await document.save();
    res.json(document);
  } catch {
    res.status(500).json({ error: 'Error al reintentar el documento fiscal' });
  }
}

export async function getDocumentFiles(req: AuthRequest, res: Response): Promise<void> {
  try {
    const document = await FiscalDocument.findById(req.params.id);
    if (!document) { res.status(404).json({ error: 'Documento fiscal no encontrado' }); return; }

    if (document.pdfUrl || document.xmlUrl) {
      res.json({ pdfUrl: document.pdfUrl, xmlUrl: document.xmlUrl });
      return;
    }

    if (!document.providerDocumentId) {
      res.status(400).json({ error: 'El documento aún no ha sido emitido' });
      return;
    }

    const config = await FiscalConfig.findOne();
    const provider = getProvider({ provider: config?.provider });
    const files = await provider.getDocumentFiles(document.providerDocumentId);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener los archivos del documento fiscal', details: String(err) });
  }
}

export async function createCreditNote(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { reason } = req.body as { reason?: string };
    if (!reason) { res.status(400).json({ error: 'El motivo es requerido' }); return; }

    const original = await FiscalDocument.findById(req.params.id);
    if (!original) { res.status(404).json({ error: 'Documento fiscal no encontrado' }); return; }
    if (original.type === 'CREDIT_NOTE') {
      res.status(400).json({ error: 'No se puede generar una nota crédito sobre otra nota crédito' });
      return;
    }
    if (original.status !== 'ACCEPTED') {
      res.status(400).json({ error: 'Solo se puede generar una nota crédito sobre un documento aceptado' });
      return;
    }

    const creditNote = await FiscalDocument.create({
      orderId: original.orderId,
      type: 'CREDIT_NOTE',
      referencedDocumentId: original._id,
      reason,
      issuerSnapshot: original.issuerSnapshot,
      acquirerSnapshot: original.acquirerSnapshot,
      totalsSnapshot: original.totalsSnapshot,
      status: 'PENDING',
      attempts: 0,
      // Disambiguated with the new document's own id so multiple credit
      // notes can be issued against the same original document.
      idempotencyKey: `${original.orderId}:CREDIT_NOTE:${original._id}:${Date.now()}`,
    });

    res.status(201).json(creditNote);
  } catch (err) {
    res.status(500).json({ error: 'Error al generar la nota crédito', details: String(err) });
  }
}

export async function getHealth(req: AuthRequest, res: Response): Promise<void> {
  try {
    const config = await FiscalConfig.findOne();
    const countsByStatus = await FiscalDocument.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const counts: Record<string, number> = {};
    for (const entry of countsByStatus) counts[entry._id] = entry.count;

    const lastAccepted = await FiscalDocument.findOne({ status: 'ACCEPTED' }).sort({ updatedAt: -1 });

    res.json({
      enabled: config?.enabled ?? false,
      environment: config?.environment ?? 'TEST',
      provider: config?.provider ?? 'MOCK',
      documentsByStatus: counts,
      lastAcceptedAt: lastAccepted?.updatedAt ?? null,
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener el estado del módulo fiscal' });
  }
}

export async function getOrderTicket(req: AuthRequest, res: Response): Promise<void> {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }

    const document = await FiscalDocument.findOne({
      orderId: order._id,
      type: { $in: ['DEE_POS', 'INVOICE'] },
    });

    if (!document) {
      const config = await FiscalConfig.findOne();
      res.json({
        applicable: config?.enabled ?? false,
        status: config?.enabled ? 'PENDING' : 'NOT_APPLICABLE',
      });
      return;
    }

    res.json({
      applicable: true,
      status: document.status,
      type: document.type,
      prefix: document.prefix,
      number: document.number,
      cufe: document.cufe,
      cude: document.cude,
      qrData: document.qrData,
      pdfUrl: document.pdfUrl,
      lastError: document.status === 'ACCEPTED' ? undefined : document.lastError,
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener el ticket fiscal del pedido' });
  }
}
