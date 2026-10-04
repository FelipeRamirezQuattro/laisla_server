import mongoose, { Document, Schema } from 'mongoose';

export type FiscalPersonType = 'NATURAL' | 'JURIDICA';
export type FiscalEnvironment = 'TEST' | 'PRODUCTION';
export type FiscalProviderName = 'MOCK' | 'ALANUBE' | 'BILIDOX';
export type FiscalDocumentTypeCode = 'DEE_POS' | 'INVOICE' | 'CREDIT_NOTE';

export interface INumberingResolution {
  documentType: FiscalDocumentTypeCode;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  currentNumber: number;
  resolutionNumber: string;
  validFrom: Date;
  validTo: Date;
  // TODO(provider-docs): required for factura tipo 01 resolutions; exact format/derivation unknown.
  technicalKey?: string;
}

export interface IFiscalIssuer {
  personType: FiscalPersonType;
  // TODO(provider-docs): confirm the accepted DIAN/provider id-type set.
  idType: 'CC' | 'NIT';
  idNumber: string;
  dv?: string;
  businessName: string;
  tradeName: string;
  // TODO(provider-docs): DIAN tax regime code.
  taxRegime?: string;
  // TODO(provider-docs): DIAN fiscal responsibility codes.
  fiscalResponsibilities: string[];
  ivaResponsible: boolean;
  consumptionTaxResponsible: boolean;
  address: string;
  municipality: string;
  // TODO(provider-docs): DIVIPOLA municipality code.
  municipalityCode?: string;
  email: string;
}

export interface IFiscalAlertThresholds {
  rangeConsumedPercent: number;
  daysBeforeExpiry: number;
}

export interface IFiscalConfig extends Document {
  enabled: boolean;
  environment: FiscalEnvironment;
  provider: FiscalProviderName;
  issuer: IFiscalIssuer;
  numbering: INumberingResolution[];
  alertThresholds: IFiscalAlertThresholds;
  createdAt: Date;
  updatedAt: Date;
}

const numberingResolutionSchema = new Schema<INumberingResolution>(
  {
    documentType: { type: String, enum: ['DEE_POS', 'INVOICE', 'CREDIT_NOTE'], required: true },
    prefix: { type: String, default: '' },
    rangeFrom: { type: Number, default: 0 },
    rangeTo: { type: Number, default: 0 },
    currentNumber: { type: Number, default: 0 },
    resolutionNumber: { type: String, default: '' },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    technicalKey: { type: String, default: '' },
  },
  { _id: false }
);

const fiscalIssuerSchema = new Schema<IFiscalIssuer>(
  {
    personType: { type: String, enum: ['NATURAL', 'JURIDICA'], default: 'NATURAL' },
    idType: { type: String, enum: ['CC', 'NIT'], default: 'CC' },
    idNumber: { type: String, default: '' },
    dv: { type: String, default: '' },
    businessName: { type: String, default: '' },
    tradeName: { type: String, default: 'La Isla Café Picnic' },
    taxRegime: { type: String, default: '' },
    fiscalResponsibilities: { type: [String], default: [] },
    ivaResponsible: { type: Boolean, default: false },
    consumptionTaxResponsible: { type: Boolean, default: false },
    address: { type: String, default: '' },
    municipality: { type: String, default: '' },
    municipalityCode: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  { _id: false }
);

const fiscalAlertThresholdsSchema = new Schema<IFiscalAlertThresholds>(
  {
    rangeConsumedPercent: { type: Number, default: 80, min: 0, max: 100 },
    daysBeforeExpiry: { type: Number, default: 30, min: 0 },
  },
  { _id: false }
);

const fiscalConfigSchema = new Schema<IFiscalConfig>(
  {
    enabled: { type: Boolean, default: false },
    environment: { type: String, enum: ['TEST', 'PRODUCTION'], default: 'TEST' },
    provider: { type: String, enum: ['MOCK', 'ALANUBE', 'BILIDOX'], default: 'MOCK' },
    issuer: { type: fiscalIssuerSchema, default: () => ({}) },
    numbering: { type: [numberingResolutionSchema], default: [] },
    alertThresholds: { type: fiscalAlertThresholdsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model<IFiscalConfig>('FiscalConfig', fiscalConfigSchema);
