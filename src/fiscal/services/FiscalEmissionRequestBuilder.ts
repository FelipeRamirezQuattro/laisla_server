import { formatLocalDate, formatLocalTime } from '../../utils/timezone';
import { mapOrderItemsToFiscalLineItems, mapPaymentMethod } from './FiscalPayloadMapper';
import type { MapperOrderItem } from './FiscalPayloadMapper';
import type {
  FiscalAcquirer,
  FiscalDocumentTypeCode,
  FiscalEmissionRequest,
  FiscalEnvironment,
  FiscalIssuer,
  FiscalReferencedDocument,
  FiscalTaxSummaryEntry,
} from '../providers/ElectronicInvoicingProvider';

export interface EmissionSourceDocument {
  orderId: string;
  type: FiscalDocumentTypeCode;
  issuerSnapshot: FiscalIssuer;
  acquirerSnapshot: FiscalAcquirer;
  totalsSnapshot: { subtotal: number; taxSummary: FiscalTaxSummaryEntry[]; total: number };
  prefix?: string;
  number?: number;
  idempotencyKey: string;
  createdAt: Date;
}

// Rebuilds the payload to send from a FiscalDocument's STORED snapshots
// (never live FiscalConfig) plus the order's immutable line items — this is
// what lets the issuer change over time while historical documents keep the
// issuer they were originally created with.
export function buildEmissionRequestFromDocument(params: {
  document: EmissionSourceDocument;
  items: MapperOrderItem[];
  paymentMethod: 'cash' | 'card' | 'transfer' | 'nequi';
  environment: FiscalEnvironment;
  referencedDocument?: FiscalReferencedDocument;
}): FiscalEmissionRequest {
  const { document, items, paymentMethod, environment, referencedDocument } = params;

  return {
    orderId: document.orderId,
    documentType: document.type,
    environment,
    issuer: document.issuerSnapshot,
    acquirer: document.acquirerSnapshot,
    items: mapOrderItemsToFiscalLineItems(items),
    taxSummary: document.totalsSnapshot.taxSummary,
    subtotal: document.totalsSnapshot.subtotal,
    total: document.totalsSnapshot.total,
    paymentMethod: mapPaymentMethod(paymentMethod),
    issueDate: formatLocalDate(document.createdAt),
    issueTime: formatLocalTime(document.createdAt),
    prefix: document.prefix,
    number: document.number,
    referencedDocument,
    idempotencyKey: document.idempotencyKey,
  };
}
