export type FiscalDocumentTypeCode = 'DEE_POS' | 'INVOICE' | 'CREDIT_NOTE';
export type FiscalTaxType = 'NONE' | 'IVA_19' | 'CONSUMO_8';
export type FiscalPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'DIGITAL_WALLET';
export type FiscalEnvironment = 'TEST' | 'PRODUCTION';
export type FiscalEmissionStatus = 'ACCEPTED' | 'REJECTED' | 'ERROR' | 'CONTINGENCY' | 'PENDING';

export interface FiscalLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxType: FiscalTaxType;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface FiscalTaxSummaryEntry {
  taxType: FiscalTaxType;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
}

// Deliberately duplicated from fiscal/models/FiscalConfig's issuer shape so
// providers/ never depends on models/ (real adapters must stay decoupled
// from Mongoose entirely).
export interface FiscalIssuer {
  personType: 'NATURAL' | 'JURIDICA';
  idType: string;
  idNumber: string;
  dv?: string;
  businessName: string;
  tradeName: string;
  taxRegime?: string;
  fiscalResponsibilities: string[];
  ivaResponsible: boolean;
  consumptionTaxResponsible: boolean;
  address: string;
  municipality: string;
  email: string;
}

export interface FiscalAcquirer {
  personType: 'NATURAL' | 'JURIDICA';
  docType: string; // 'CONSUMIDOR_FINAL' | 'CC' | 'NIT' | 'CE' | ...
  docNumber: string;
  dv?: string;
  name: string;
  email?: string;
}

export interface FiscalReferencedDocument {
  cufe?: string;
  cude?: string;
  prefix?: string;
  number?: number;
}

export interface FiscalEmissionRequest {
  orderId: string;
  documentType: FiscalDocumentTypeCode;
  environment: FiscalEnvironment;
  issuer: FiscalIssuer;
  acquirer: FiscalAcquirer;
  items: FiscalLineItem[];
  taxSummary: FiscalTaxSummaryEntry[];
  subtotal: number;
  total: number;
  paymentMethod: FiscalPaymentMethod;
  issueDate: string; // 'yyyy-MM-dd', America/Bogota
  issueTime: string; // 'HH:mm:ss', America/Bogota
  prefix?: string;
  number?: number;
  referencedDocument?: FiscalReferencedDocument; // required when documentType === 'CREDIT_NOTE'
  idempotencyKey: string;
}

export interface FiscalEmissionResult {
  success: boolean;
  status: FiscalEmissionStatus;
  providerDocumentId?: string;
  cufe?: string;
  cude?: string;
  qrData?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  errorMessage?: string;
  // The implementer must sanitize this (strip auth headers/tokens) before persisting.
  rawResponse?: unknown;
}

export interface FiscalStatusResult {
  status: FiscalEmissionStatus;
  cufe?: string;
  cude?: string;
  qrData?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  rawResponse?: unknown;
}

export interface FiscalFilesResult {
  pdfUrl?: string;
  xmlUrl?: string;
}

export interface FiscalWebhookEvent {
  providerDocumentId?: string;
  status: FiscalEmissionStatus;
  raw: unknown;
}

export interface ElectronicInvoicingProvider {
  readonly name: string;
  emitPosDocument(request: FiscalEmissionRequest): Promise<FiscalEmissionResult>;
  emitInvoice(request: FiscalEmissionRequest): Promise<FiscalEmissionResult>;
  emitCreditNote(request: FiscalEmissionRequest): Promise<FiscalEmissionResult>;
  getStatus(providerDocumentId: string): Promise<FiscalStatusResult>;
  getDocumentFiles(providerDocumentId: string): Promise<FiscalFilesResult>;
  parseWebhook?(payload: unknown): FiscalWebhookEvent | null;
}
