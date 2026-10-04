import { formatLocalDate, formatLocalTime, localNow } from '../../utils/timezone';
import type {
  FiscalAcquirer,
  FiscalDocumentTypeCode,
  FiscalEmissionRequest,
  FiscalEnvironment,
  FiscalIssuer,
  FiscalLineItem,
  FiscalPaymentMethod,
  FiscalReferencedDocument,
  FiscalTaxSummaryEntry,
  FiscalTaxType,
} from '../providers/ElectronicInvoicingProvider';

// TODO(provider-docs): confirm the exact generic "consumidor final" document
// number the chosen provider (Alanube/Bilidox) expects.
const CONSUMIDOR_FINAL_DOC_NUMBER = '222222222222';

const PAYMENT_METHOD_MAP: Record<'cash' | 'card' | 'transfer' | 'nequi', FiscalPaymentMethod> = {
  cash: 'CASH',
  card: 'CARD',
  transfer: 'TRANSFER',
  nequi: 'DIGITAL_WALLET',
};

export interface MapperOrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  taxType: FiscalTaxType;
  taxRate: number;
  taxAmount: number;
}

export interface MapperOrder {
  _id: string;
  subtotal: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'nequi';
  items: MapperOrderItem[];
}

export interface MapperCustomerFiscal {
  docType?: string;
  docNumber?: string;
  dv?: string;
  businessName?: string;
  fiscalEmail?: string;
}

export interface MapperCustomer {
  personType?: 'NATURAL' | 'JURIDICA';
  fiscal?: MapperCustomerFiscal;
  name?: string;
  email?: string;
}

export interface MapperFiscalConfig {
  environment: FiscalEnvironment;
  issuer: FiscalIssuer;
}

export function selectDocumentType(customer?: MapperCustomer | null): 'DEE_POS' | 'INVOICE' {
  return customer?.fiscal?.docNumber ? 'INVOICE' : 'DEE_POS';
}

export function mapPaymentMethod(paymentMethod: 'cash' | 'card' | 'transfer' | 'nequi'): FiscalPaymentMethod {
  return PAYMENT_METHOD_MAP[paymentMethod];
}

export function mapOrderItemsToFiscalLineItems(items: MapperOrderItem[]): FiscalLineItem[] {
  return items.map((item) => ({
    description: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxType: item.taxType,
    taxRate: item.taxRate,
    taxAmount: item.taxAmount,
    lineTotal: Math.round(item.unitPrice * item.quantity + item.taxAmount),
  }));
}

function buildAcquirer(customer?: MapperCustomer | null): FiscalAcquirer {
  if (!customer?.fiscal?.docNumber) {
    return {
      personType: 'NATURAL',
      docType: 'CONSUMIDOR_FINAL',
      docNumber: CONSUMIDOR_FINAL_DOC_NUMBER,
      name: 'Consumidor Final',
    };
  }

  return {
    personType: customer.personType ?? 'NATURAL',
    docType: customer.fiscal.docType ?? '',
    docNumber: customer.fiscal.docNumber,
    dv: customer.fiscal.dv,
    name: customer.fiscal.businessName || customer.name || '',
    email: customer.fiscal.fiscalEmail || customer.email,
  };
}

function assertTaxResponsibility(order: MapperOrder, config: MapperFiscalConfig): void {
  for (const item of order.items) {
    if (item.taxType === 'IVA_19' && !config.issuer.ivaResponsible) {
      throw new Error(
        'Order contains IVA_19 lines but the configured issuer is not IVA-responsible (FiscalConfig.issuer.ivaResponsible)'
      );
    }
    if (item.taxType === 'CONSUMO_8' && !config.issuer.consumptionTaxResponsible) {
      throw new Error(
        'Order contains CONSUMO_8 lines but the configured issuer is not consumption-tax-responsible (FiscalConfig.issuer.consumptionTaxResponsible)'
      );
    }
  }
}

function buildIdempotencyKey(
  orderId: string,
  documentType: FiscalDocumentTypeCode,
  referencedDocument?: FiscalReferencedDocument
): string {
  if (documentType === 'CREDIT_NOTE') {
    const refId = referencedDocument?.cude ?? referencedDocument?.cufe ?? '';
    return `${orderId}:CREDIT_NOTE:${refId}`;
  }
  return `${orderId}:${documentType}`;
}

export function buildFiscalPayload(params: {
  order: MapperOrder;
  config: MapperFiscalConfig;
  customer?: MapperCustomer | null;
  documentType?: FiscalDocumentTypeCode;
  referencedDocument?: FiscalReferencedDocument;
  now?: Date;
}): FiscalEmissionRequest {
  const { order, config, customer, referencedDocument } = params;
  const documentType = params.documentType ?? selectDocumentType(customer);

  if (documentType === 'CREDIT_NOTE' && !referencedDocument) {
    throw new Error('referencedDocument is required when documentType is CREDIT_NOTE');
  }

  assertTaxResponsibility(order, config);

  const items: FiscalLineItem[] = mapOrderItemsToFiscalLineItems(order.items);

  const groups = new Map<
    string,
    { taxType: FiscalTaxType; taxRate: number; taxableAmount: number; taxAmount: number }
  >();
  for (const item of order.items) {
    const key = `${item.taxType}:${item.taxRate}`;
    const group = groups.get(key) ?? { taxType: item.taxType, taxRate: item.taxRate, taxableAmount: 0, taxAmount: 0 };
    group.taxableAmount += item.unitPrice * item.quantity;
    group.taxAmount += item.taxAmount;
    groups.set(key, group);
  }

  const taxSummary: FiscalTaxSummaryEntry[] = Array.from(groups.values()).map((group) => ({
    taxType: group.taxType,
    taxRate: group.taxRate,
    taxableAmount: Math.round(group.taxableAmount),
    taxAmount: Math.round(group.taxAmount),
  }));

  // Naive per-group rounding to whole pesos can leave subtotal+tax off by a
  // few pesos from order.total. Reconcile by nudging the largest group's
  // taxableAmount once — a single, auditable adjustment rather than
  // distributing the diff line-by-line.
  let subtotal = taxSummary.reduce((sum, group) => sum + group.taxableAmount, 0);
  const totalTax = taxSummary.reduce((sum, group) => sum + group.taxAmount, 0);
  const delta = order.total - (subtotal + totalTax);
  if (delta !== 0 && taxSummary.length > 0) {
    const largest = taxSummary.reduce((max, group) => (group.taxableAmount > max.taxableAmount ? group : max));
    largest.taxableAmount += delta;
    subtotal += delta;
  }

  const now = params.now ?? localNow();

  return {
    orderId: order._id,
    documentType,
    environment: config.environment,
    issuer: config.issuer,
    acquirer: buildAcquirer(customer),
    items,
    taxSummary,
    subtotal,
    total: order.total,
    paymentMethod: mapPaymentMethod(order.paymentMethod),
    issueDate: formatLocalDate(now),
    issueTime: formatLocalTime(now),
    referencedDocument,
    idempotencyKey: buildIdempotencyKey(order._id, documentType, referencedDocument),
  };
}
