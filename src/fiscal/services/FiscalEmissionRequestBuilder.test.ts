import { describe, expect, it } from 'vitest';
import { buildEmissionRequestFromDocument } from './FiscalEmissionRequestBuilder';
import type { EmissionSourceDocument } from './FiscalEmissionRequestBuilder';

function baseDocument(overrides: Partial<EmissionSourceDocument> = {}): EmissionSourceDocument {
  return {
    orderId: 'order-1',
    type: 'DEE_POS',
    issuerSnapshot: {
      personType: 'NATURAL',
      idType: 'CC',
      idNumber: '123456',
      businessName: 'Oscar Ramirez',
      tradeName: 'La Isla Café Picnic',
      fiscalResponsibilities: [],
      ivaResponsible: true,
      consumptionTaxResponsible: true,
      address: 'Cra 1',
      municipality: 'Ibagué',
      email: 'oscar@laislacafepicnic.com',
    },
    acquirerSnapshot: {
      personType: 'NATURAL',
      docType: 'CONSUMIDOR_FINAL',
      docNumber: '222222222222',
      name: 'Consumidor Final',
    },
    totalsSnapshot: {
      subtotal: 1000,
      taxSummary: [{ taxType: 'IVA_19', taxRate: 0.19, taxableAmount: 1000, taxAmount: 190 }],
      total: 1190,
    },
    idempotencyKey: 'order-1:DEE_POS',
    createdAt: new Date(Date.UTC(2026, 8, 29, 21, 5, 30)), // localNow()-style: UTC fields = Bogota clock
    ...overrides,
  };
}

const ITEMS = [
  { productName: 'Café', quantity: 1, unitPrice: 1000, taxType: 'IVA_19' as const, taxRate: 0.19, taxAmount: 190 },
];

describe('buildEmissionRequestFromDocument', () => {
  it('uses the document snapshots verbatim, not any live config', () => {
    const result = buildEmissionRequestFromDocument({
      document: baseDocument(),
      items: ITEMS,
      paymentMethod: 'cash',
      environment: 'TEST',
    });
    expect(result.issuer).toEqual(baseDocument().issuerSnapshot);
    expect(result.acquirer).toEqual(baseDocument().acquirerSnapshot);
    expect(result.subtotal).toBe(1000);
    expect(result.total).toBe(1190);
    expect(result.taxSummary).toEqual(baseDocument().totalsSnapshot.taxSummary);
  });

  it('rebuilds line items from the given order items', () => {
    const result = buildEmissionRequestFromDocument({
      document: baseDocument(),
      items: ITEMS,
      paymentMethod: 'cash',
      environment: 'TEST',
    });
    expect(result.items).toEqual([
      { description: 'Café', quantity: 1, unitPrice: 1000, taxType: 'IVA_19', taxRate: 0.19, taxAmount: 190, lineTotal: 1190 },
    ]);
  });

  it('formats issueDate/issueTime from document.createdAt, not the current time', () => {
    const result = buildEmissionRequestFromDocument({
      document: baseDocument(),
      items: ITEMS,
      paymentMethod: 'cash',
      environment: 'TEST',
    });
    expect(result.issueDate).toBe('2026-09-29');
    expect(result.issueTime).toBe('21:05:30');
  });

  it('maps the payment method', () => {
    const result = buildEmissionRequestFromDocument({
      document: baseDocument(),
      items: ITEMS,
      paymentMethod: 'transfer',
      environment: 'TEST',
    });
    expect(result.paymentMethod).toBe('TRANSFER');
  });

  it('includes prefix/number when the document has them assigned', () => {
    const result = buildEmissionRequestFromDocument({
      document: baseDocument({ prefix: 'DPOS', number: 42 }),
      items: ITEMS,
      paymentMethod: 'cash',
      environment: 'TEST',
    });
    expect(result.prefix).toBe('DPOS');
    expect(result.number).toBe(42);
  });

  it('passes through a referencedDocument for a credit note', () => {
    const referencedDocument = { cude: 'MOCK-abc', prefix: 'DPOS', number: 10 };
    const result = buildEmissionRequestFromDocument({
      document: baseDocument({ type: 'CREDIT_NOTE' }),
      items: ITEMS,
      paymentMethod: 'cash',
      environment: 'TEST',
      referencedDocument,
    });
    expect(result.referencedDocument).toEqual(referencedDocument);
    expect(result.documentType).toBe('CREDIT_NOTE');
  });

  it('reuses the document idempotencyKey rather than recomputing one', () => {
    const result = buildEmissionRequestFromDocument({
      document: baseDocument({ idempotencyKey: 'order-1:DEE_POS:custom' }),
      items: ITEMS,
      paymentMethod: 'cash',
      environment: 'TEST',
    });
    expect(result.idempotencyKey).toBe('order-1:DEE_POS:custom');
  });
});
