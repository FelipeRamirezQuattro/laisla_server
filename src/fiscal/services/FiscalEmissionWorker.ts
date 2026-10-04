import Order from '../../models/Order';
import FiscalConfig from '../models/FiscalConfig';
import FiscalDocument from '../models/FiscalDocument';
import type { IFiscalDocument } from '../models/FiscalDocument';
import { MAX_FISCAL_ATTEMPTS, calculateNextAttemptAt } from './FiscalBackoff';
import { buildEmissionRequestFromDocument } from './FiscalEmissionRequestBuilder';
import { reserveNextNumber } from './FiscalNumberingService';
import { getProvider } from '../providers/getProvider';
import type { ElectronicInvoicingProvider, FiscalEmissionResult, FiscalReferencedDocument } from '../providers/ElectronicInvoicingProvider';
import { createReceiptJobForFiscalDocument } from '../../printing/services/PrintJobService';

const POLL_INTERVAL_MS = 15_000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

// "Recupera documentos atascados en SENDING al arrancar": a process crash
// mid-emission can leave a document locked in SENDING forever, so any
// SENDING document found at startup is assumed orphaned and reset to
// PENDING for the worker to pick up again.
export async function recoverStuckSendingDocuments(): Promise<number> {
  const result = await FiscalDocument.updateMany({ status: 'SENDING' }, { $set: { status: 'PENDING' } });
  return result.modifiedCount ?? 0;
}

async function lockNextDueDocument(): Promise<IFiscalDocument | null> {
  const now = new Date();
  return FiscalDocument.findOneAndUpdate(
    { $or: [{ status: 'PENDING' }, { status: 'ERROR', nextAttemptAt: { $lte: now } }] },
    { $set: { status: 'SENDING' } },
    { sort: { createdAt: 1 }, new: true }
  );
}

async function callProvider(
  provider: ElectronicInvoicingProvider,
  document: IFiscalDocument,
  request: Parameters<ElectronicInvoicingProvider['emitPosDocument']>[0]
): Promise<FiscalEmissionResult> {
  if (document.type === 'INVOICE') return provider.emitInvoice(request);
  if (document.type === 'CREDIT_NOTE') return provider.emitCreditNote(request);
  return provider.emitPosDocument(request);
}

function applyFailure(document: IFiscalDocument, errorMessage: string, now: Date): void {
  document.attempts += 1;
  document.lastError = errorMessage;
  if (document.attempts >= MAX_FISCAL_ATTEMPTS) {
    document.status = 'CONTINGENCY';
    document.nextAttemptAt = undefined;
  } else {
    document.status = 'ERROR';
    document.nextAttemptAt = calculateNextAttemptAt(document.attempts, now);
  }
}

function applySuccess(document: IFiscalDocument, result: FiscalEmissionResult): void {
  document.status = 'ACCEPTED';
  document.providerDocumentId = result.providerDocumentId;
  document.cufe = result.cufe;
  document.cude = result.cude;
  document.qrData = result.qrData;
  document.pdfUrl = result.pdfUrl;
  document.xmlUrl = result.xmlUrl;
  document.rawResponse = result.rawResponse;
  document.lastError = '';
}

// Processes at most one due document per call (PENDING, or ERROR whose
// nextAttemptAt has passed). Returns false when there was nothing to do.
// Never throws — provider/network failures are recorded on the document via
// the retry/backoff fields instead of propagating.
export async function processNextFiscalDocument(): Promise<boolean> {
  const document = await lockNextDueDocument();
  if (!document) return false;

  const now = new Date();

  try {
    const [order, config] = await Promise.all([Order.findById(document.orderId), FiscalConfig.findOne()]);

    if (!order) throw new Error(`Order ${document.orderId} not found`);
    if (!config) throw new Error('FiscalConfig not found');

    if (document.type !== 'CREDIT_NOTE' && !document.prefix) {
      const assigned = await reserveNextNumber(config, document.type);
      if (assigned) {
        document.prefix = assigned.prefix;
        document.number = assigned.number;
      }
    }

    let referencedDocument: FiscalReferencedDocument | undefined;
    if (document.type === 'CREDIT_NOTE' && document.referencedDocumentId) {
      const referenced = await FiscalDocument.findById(document.referencedDocumentId);
      if (referenced) {
        referencedDocument = {
          cude: referenced.cude,
          cufe: referenced.cufe,
          prefix: referenced.prefix,
          number: referenced.number,
        };
      }
    }

    const request = buildEmissionRequestFromDocument({
      document: {
        orderId: document.orderId.toString(),
        type: document.type,
        issuerSnapshot: document.issuerSnapshot,
        acquirerSnapshot: document.acquirerSnapshot,
        totalsSnapshot: document.totalsSnapshot,
        prefix: document.prefix,
        number: document.number,
        idempotencyKey: document.idempotencyKey,
        createdAt: document.createdAt,
      },
      items: order.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxType: item.taxType ?? 'NONE',
        taxRate: item.taxRate ?? 0,
        taxAmount: item.taxAmount ?? 0,
      })),
      paymentMethod: order.paymentMethod ?? 'cash',
      environment: config.environment,
      referencedDocument,
    });

    const provider = getProvider({ provider: config.provider });
    const result = await callProvider(provider, document, request);

    if (result.success && result.status === 'ACCEPTED') {
      applySuccess(document, result);
    } else if (result.status === 'REJECTED') {
      // Business rejection — retrying blindly won't help; needs a manual
      // fix (e.g. via the admin retry endpoint after correcting data).
      document.status = 'REJECTED';
      document.lastError = result.errorMessage ?? 'Rejected by provider';
    } else if (result.status === 'CONTINGENCY') {
      document.status = 'CONTINGENCY';
      document.lastError = result.errorMessage ?? 'Provider reported contingency';
    } else {
      applyFailure(document, result.errorMessage ?? 'Provider returned a non-accepted status', now);
    }
  } catch (err) {
    applyFailure(document, err instanceof Error ? err.message : String(err), now);
  }

  await document.save();

  // Ticket de caja: best-effort, nunca debe hacer fallar el ciclo de emisión
  // fiscal. Cubre tanto la aceptación normal como la contingencia (que
  // también debe imprimirse, con su leyenda correspondiente).
  if (document.status === 'ACCEPTED' || document.status === 'CONTINGENCY') {
    try {
      const order = await Order.findById(document.orderId);
      if (order) await createReceiptJobForFiscalDocument(document, order);
    } catch (err) {
      console.error(`Error creando el trabajo de impresión del ticket para la orden ${document.orderId}:`, err);
    }
  }

  return true;
}

export function startFiscalEmissionWorker(): void {
  recoverStuckSendingDocuments().catch((err) => {
    console.error('Error recovering stuck fiscal documents:', err);
  });

  intervalHandle = setInterval(() => {
    if (isProcessing) return;
    isProcessing = true;
    processNextFiscalDocument()
      .catch((err) => console.error('Error processing fiscal document:', err))
      .finally(() => {
        isProcessing = false;
      });
  }, POLL_INTERVAL_MS);
}

export function stopFiscalEmissionWorker(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}
