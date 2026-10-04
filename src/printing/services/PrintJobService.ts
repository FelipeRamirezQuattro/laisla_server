import mongoose from 'mongoose';
import Printer, { IPrinter } from '../models/Printer';
import PrintConfig, { IPrintConfig } from '../models/PrintConfig';
import PrintJob, { IPrintJob } from '../models/PrintJob';
import Table from '../../models/Table';
import type { IOrder } from '../../models/Order';
import type { IFiscalDocument } from '../../fiscal/models/FiscalDocument';
import { localNow } from '../../utils/timezone';
import { buildKitchenOrderPayload, buildReceiptPayload, buildTestPrintPayload, ReceiptFiscalDocumentInput, ReceiptTableInput } from './ReceiptPayloadBuilder';

export const DEFAULT_CLAIM_TIMEOUT_SECONDS = 60;
export const DEFAULT_MAX_ATTEMPTS = 3;

// ---- Pure decision helpers (unit-tested directly in PrintJobService.test.ts) ----

// A missing PrintConfig singleton (fresh install, seed not yet run) falls
// back to the schema's own default so receipts still print out of the box.
export function shouldAutoPrintReceipt(config: Pick<IPrintConfig, 'receiptAutoPrint'> | null): boolean {
  return config ? config.receiptAutoPrint : true;
}

// Kitchen printing needs both the switch on AND an active BARRA printer —
// missing either one means "do nothing, no error", never a partial job.
export function shouldCreateKitchenJob(
  config: Pick<IPrintConfig, 'kitchenPrintingEnabled'> | null,
  hasActiveBarraPrinter: boolean
): boolean {
  const enabled = config ? config.kitchenPrintingEnabled : false;
  return enabled && hasActiveBarraPrinter;
}

export interface StaleClaimDecision {
  nextStatus: 'PENDING' | 'FAILED';
  nextAttempts: number;
}

// Shared by the stale-CLAIMED requeue sweep and the device's failure report
// — both are "this attempt didn't finish, try again or give up" decisions.
export function decideStaleClaimOutcome(job: { attempts: number }, maxAttempts: number): StaleClaimDecision {
  const nextAttempts = job.attempts + 1;
  return {
    nextStatus: nextAttempts >= maxAttempts ? 'FAILED' : 'PENDING',
    nextAttempts,
  };
}

// ---- Mongoose orchestration (mirrors FiscalDocumentService: not unit-tested directly) ----

function toReceiptFiscalInput(document: IFiscalDocument | null | undefined): ReceiptFiscalDocumentInput | null {
  if (!document) return null;
  return {
    type: document.type,
    status: document.status,
    prefix: document.prefix,
    number: document.number,
    cude: document.cude,
    qrData: document.qrData,
    issuerSnapshot: document.issuerSnapshot,
    totalsSnapshot: document.totalsSnapshot,
  };
}

async function resolveTableInput(order: Pick<IOrder, 'tableId' | 'orderType'>): Promise<ReceiptTableInput> {
  if (order.orderType === 'walk-in' || !order.tableId) return { isWalkIn: true };
  const table = await Table.findById(order.tableId).select('name');
  return { isWalkIn: false, tableName: table?.name };
}

async function resolvePrintConfig(): Promise<{
  config: IPrintConfig | null;
  headerText: string;
  footerText: string;
  openDrawerOnCash: boolean;
  businessNit?: string;
  businessPhone?: string;
  businessSocial?: string;
}> {
  const config = await PrintConfig.findOne();
  return {
    config,
    headerText: config?.headerText ?? 'La Isla - Café Picnic',
    footerText: config?.footerText ?? '',
    openDrawerOnCash: config?.openDrawerOnCash ?? true,
    businessNit: config?.businessNit,
    businessPhone: config?.businessPhone,
    businessSocial: config?.businessSocial,
  };
}

// Creates the RECEIPT job at order-close time — only used when the fiscal
// module is disabled. Idempotent via PrintJob's partial unique index.
export async function createReceiptJobIfNeeded(
  order: IOrder,
  options?: { amountReceived?: number }
): Promise<IPrintJob | null> {
  const { config, headerText, footerText, openDrawerOnCash, businessNit, businessPhone, businessSocial } = await resolvePrintConfig();
  if (!shouldAutoPrintReceipt(config)) return null;

  const existing = await PrintJob.findOne({ orderId: order._id, type: 'RECEIPT' });
  if (existing) return existing;

  const printer = await Printer.findOne({ role: 'CAJA', isActive: true });
  const table = await resolveTableInput(order);
  const payload = buildReceiptPayload({
    order: {
      _id: order._id,
      items: order.items,
      subtotal: order.subtotal,
      total: order.total,
      paymentMethod: order.paymentMethod,
      at: order.billedAt ?? localNow(),
    },
    table,
    fiscalDocument: null,
    printConfig: { headerText, footerText, openDrawerOnCash, businessNit, businessPhone, businessSocial },
    amountReceived: options?.amountReceived,
  });

  return PrintJob.create({
    type: 'RECEIPT',
    printerId: printer?._id ?? null,
    orderId: order._id,
    payload,
    status: 'PENDING',
  });
}

// Creates the RECEIPT job once a FiscalDocument reaches ACCEPTED or
// CONTINGENCY — called from both FiscalEmissionWorker and the fiscal
// webhook controller, which can race to observe the same transition.
export async function createReceiptJobForFiscalDocument(
  document: IFiscalDocument,
  order: IOrder
): Promise<IPrintJob | null> {
  if (document.type === 'CREDIT_NOTE') return null;

  const { config, headerText, footerText, openDrawerOnCash, businessNit, businessPhone, businessSocial } = await resolvePrintConfig();
  if (!shouldAutoPrintReceipt(config)) return null;

  const existing = await PrintJob.findOne({ orderId: order._id, type: 'RECEIPT' });
  if (existing) return existing;

  const printer = await Printer.findOne({ role: 'CAJA', isActive: true });
  const table = await resolveTableInput(order);
  const payload = buildReceiptPayload({
    order: {
      _id: order._id,
      items: order.items,
      subtotal: order.subtotal,
      total: order.total,
      paymentMethod: order.paymentMethod,
      at: order.billedAt ?? localNow(),
    },
    table,
    fiscalDocument: toReceiptFiscalInput(document),
    printConfig: { headerText, footerText, openDrawerOnCash, businessNit, businessPhone, businessSocial },
  });

  try {
    return await PrintJob.create({
      type: 'RECEIPT',
      printerId: printer?._id ?? null,
      orderId: order._id,
      fiscalDocumentId: document._id,
      payload,
      status: 'PENDING',
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return PrintJob.findOne({ orderId: order._id, type: 'RECEIPT' });
    }
    throw err;
  }
}

// Creates the KITCHEN_ORDER job when an order transitions to in-progress —
// a no-op (not an error) unless the switch is on AND a BARRA printer exists.
export async function createKitchenJobIfNeeded(order: IOrder): Promise<IPrintJob | null> {
  const config = await PrintConfig.findOne();
  const barraPrinter = await Printer.findOne({ role: 'BARRA', isActive: true });
  if (!shouldCreateKitchenJob(config, Boolean(barraPrinter))) return null;

  const table = await resolveTableInput(order);
  const payload = buildKitchenOrderPayload({
    order: { _id: order._id, items: order.items, notes: order.notes, at: localNow() },
    table,
  });

  return PrintJob.create({
    type: 'KITCHEN_ORDER',
    printerId: barraPrinter!._id,
    orderId: order._id,
    payload,
    status: 'PENDING',
  });
}

export async function createTestPrintJob(printer: IPrinter): Promise<IPrintJob> {
  const payload = buildTestPrintPayload({ printerName: printer.name, ip: printer.ip, at: localNow() });
  return PrintJob.create({
    type: 'TEST',
    printerId: printer._id,
    payload,
    status: 'PENDING',
  });
}

// Manual "Reimprimir ticket" from the admin — bypasses the RECEIPT
// idempotency guard on purpose (type REPRINT is outside that unique index),
// and never opens the cash drawer (enforced agent-side).
export async function createReprintJob(
  order: IOrder,
  fiscalDocument: IFiscalDocument | null,
  amountReceived?: number
): Promise<IPrintJob> {
  const { headerText, footerText, openDrawerOnCash, businessNit, businessPhone, businessSocial } = await resolvePrintConfig();
  const printer = await Printer.findOne({ role: 'CAJA', isActive: true });
  const table = await resolveTableInput(order);
  const payload = buildReceiptPayload({
    order: {
      _id: order._id,
      items: order.items,
      subtotal: order.subtotal,
      total: order.total,
      paymentMethod: order.paymentMethod,
      at: localNow(),
    },
    table,
    fiscalDocument: toReceiptFiscalInput(fiscalDocument),
    printConfig: { headerText, footerText, openDrawerOnCash, businessNit, businessPhone, businessSocial },
    amountReceived,
    // A reprint never opens the drawer, no matter what PrintConfig says.
    allowCashDrawer: false,
  });

  return PrintJob.create({
    type: 'REPRINT',
    printerId: printer?._id ?? null,
    orderId: order._id,
    fiscalDocumentId: fiscalDocument?._id,
    payload,
    status: 'PENDING',
  });
}

export async function retryPrintJob(jobId: string): Promise<IPrintJob | null> {
  const job = await PrintJob.findById(jobId);
  if (!job || job.status !== 'FAILED') return job;
  job.status = 'PENDING';
  job.attempts = 0;
  job.error = '';
  job.claimedAt = undefined;
  await job.save();
  return job;
}

export async function claimNextJobForAgent(printerIds: mongoose.Types.ObjectId[]): Promise<IPrintJob | null> {
  if (!printerIds.length) return null;
  return PrintJob.findOneAndUpdate(
    { status: 'PENDING', printerId: { $in: printerIds } },
    { $set: { status: 'CLAIMED', claimedAt: localNow() } },
    { sort: { createdAt: 1 }, new: true }
  ).populate('printerId');
}

export async function reportJobResult(
  jobId: string,
  result: { success: boolean; error?: string },
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): Promise<IPrintJob | null> {
  const job = await PrintJob.findById(jobId);
  if (!job) return null;

  if (result.success) {
    job.status = 'DONE';
    job.error = '';
  } else {
    const decision = decideStaleClaimOutcome({ attempts: job.attempts }, maxAttempts);
    job.attempts = decision.nextAttempts;
    job.status = decision.nextStatus;
    job.error = result.error || 'Error desconocido al imprimir';
  }
  await job.save();
  return job;
}

// Recovers jobs an agent claimed but never reported back on (crash, network
// drop) — reencola hasta agotar los intentos, luego las marca FAILED.
export async function requeueStaleClaimedJobs(
  claimTimeoutSeconds = DEFAULT_CLAIM_TIMEOUT_SECONDS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): Promise<{ requeued: number; failed: number }> {
  const cutoff = new Date(localNow().getTime() - claimTimeoutSeconds * 1000);
  const staleJobs = await PrintJob.find({ status: 'CLAIMED', claimedAt: { $lte: cutoff } });

  let requeued = 0;
  let failed = 0;
  for (const job of staleJobs) {
    const decision = decideStaleClaimOutcome({ attempts: job.attempts }, maxAttempts);
    job.attempts = decision.nextAttempts;
    job.status = decision.nextStatus;
    if (decision.nextStatus === 'FAILED') {
      job.error = job.error || 'Tiempo de espera agotado esperando confirmación del agente';
      failed += 1;
    } else {
      job.claimedAt = undefined;
      requeued += 1;
    }
    await job.save();
  }

  return { requeued, failed };
}
