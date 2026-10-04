import mongoose, { Document, Schema } from 'mongoose';
import type { FiscalDocumentTypeCode, FiscalPersonType } from './FiscalConfig';

export type FiscalDocumentStatus = 'PENDING' | 'SENDING' | 'ACCEPTED' | 'REJECTED' | 'ERROR' | 'CONTINGENCY';

export interface IFiscalTaxSummaryEntry {
  taxType: 'NONE' | 'IVA_19' | 'CONSUMO_8';
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface IFiscalIssuerSnapshot {
  personType: FiscalPersonType;
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

export interface IFiscalAcquirerSnapshot {
  personType: 'NATURAL' | 'JURIDICA';
  docType: string; // 'CONSUMIDOR_FINAL' | 'CC' | 'NIT' | 'CE' | ...
  docNumber: string;
  dv?: string;
  name: string;
  email?: string;
}

export interface IFiscalTotalsSnapshot {
  subtotal: number;
  taxSummary: IFiscalTaxSummaryEntry[];
  total: number;
}

export interface IFiscalDocument extends Document {
  orderId: mongoose.Types.ObjectId;
  type: FiscalDocumentTypeCode;
  referencedDocumentId?: mongoose.Types.ObjectId;
  reason?: string; // motivo, only meaningful for type === 'CREDIT_NOTE'
  issuerSnapshot: IFiscalIssuerSnapshot;
  acquirerSnapshot: IFiscalAcquirerSnapshot;
  totalsSnapshot: IFiscalTotalsSnapshot;
  prefix?: string;
  number?: number;
  status: FiscalDocumentStatus;
  cufe?: string;
  cude?: string;
  qrData?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  providerDocumentId?: string;
  attempts: number;
  nextAttemptAt?: Date;
  lastError?: string;
  // Mixed; the caller is responsible for sanitizing (no tokens/secrets) before persisting.
  rawResponse?: unknown;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const taxSummaryEntrySchema = new Schema<IFiscalTaxSummaryEntry>(
  {
    taxType: { type: String, enum: ['NONE', 'IVA_19', 'CONSUMO_8'], required: true },
    taxRate: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const issuerSnapshotSchema = new Schema<IFiscalIssuerSnapshot>(
  {
    personType: { type: String, enum: ['NATURAL', 'JURIDICA'], required: true },
    idType: { type: String, required: true },
    idNumber: { type: String, required: true },
    dv: { type: String, default: '' },
    businessName: { type: String, required: true },
    tradeName: { type: String, default: '' },
    taxRegime: { type: String, default: '' },
    fiscalResponsibilities: { type: [String], default: [] },
    ivaResponsible: { type: Boolean, default: false },
    consumptionTaxResponsible: { type: Boolean, default: false },
    address: { type: String, default: '' },
    municipality: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  { _id: false }
);

const acquirerSnapshotSchema = new Schema<IFiscalAcquirerSnapshot>(
  {
    personType: { type: String, enum: ['NATURAL', 'JURIDICA'], required: true },
    docType: { type: String, required: true },
    docNumber: { type: String, required: true },
    dv: { type: String, default: '' },
    name: { type: String, required: true },
    email: { type: String, default: '' },
  },
  { _id: false }
);

const totalsSnapshotSchema = new Schema<IFiscalTotalsSnapshot>(
  {
    subtotal: { type: Number, required: true },
    taxSummary: { type: [taxSummaryEntrySchema], default: [] },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const fiscalDocumentSchema = new Schema<IFiscalDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    type: { type: String, enum: ['DEE_POS', 'INVOICE', 'CREDIT_NOTE'], required: true },
    referencedDocumentId: { type: Schema.Types.ObjectId, ref: 'FiscalDocument', default: null },
    reason: { type: String, default: '' },
    issuerSnapshot: { type: issuerSnapshotSchema, required: true },
    acquirerSnapshot: { type: acquirerSnapshotSchema, required: true },
    totalsSnapshot: { type: totalsSnapshotSchema, required: true },
    prefix: { type: String, default: '' },
    number: { type: Number, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'SENDING', 'ACCEPTED', 'REJECTED', 'ERROR', 'CONTINGENCY'],
      default: 'PENDING',
    },
    cufe: { type: String, default: '' },
    cude: { type: String, default: '' },
    qrData: { type: String, default: '' },
    pdfUrl: { type: String, default: '' },
    xmlUrl: { type: String, default: '' },
    providerDocumentId: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
    rawResponse: { type: Schema.Types.Mixed, default: null },
    idempotencyKey: { type: String, required: true },
  },
  { timestamps: true }
);

// A single order can only ever produce one primary emission (DEE_POS or
// INVOICE, never both); credit notes are exempt so an order can later
// receive one or more credit notes against that primary document.
fiscalDocumentSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { type: { $in: ['DEE_POS', 'INVOICE'] } } }
);
fiscalDocumentSchema.index({ idempotencyKey: 1 }, { unique: true });
fiscalDocumentSchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.model<IFiscalDocument>('FiscalDocument', fiscalDocumentSchema);
