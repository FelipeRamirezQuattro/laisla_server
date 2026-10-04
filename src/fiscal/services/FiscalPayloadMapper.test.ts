import { describe, expect, it } from 'vitest';
import { buildFiscalPayload, selectDocumentType } from './FiscalPayloadMapper';
import type { MapperFiscalConfig, MapperOrder } from './FiscalPayloadMapper';

const NOW = new Date(Date.UTC(2026, 8, 29, 21, 5, 30)); // localNow()-style: UTC fields = Bogota clock

function baseConfig(overrides: Partial<MapperFiscalConfig['issuer']> = {}): MapperFiscalConfig {
  return {
    environment: 'TEST',
    issuer: {
      personType: 'NATURAL',
      idType: 'CC',
      idNumber: '123456',
      businessName: 'Oscar Ramirez',
      tradeName: 'La Isla Café Picnic',
      fiscalResponsibilities: [],
      ivaResponsible: true,
      consumptionTaxResponsible: true,
      address: 'Cra 1 # 2-3',
      municipality: 'Ibagué',
      email: 'oscar@laislacafepicnic.com',
      ...overrides,
    },
  };
}

function baseOrder(overrides: Partial<MapperOrder> = {}): MapperOrder {
  return {
    _id: 'order-1',
    subtotal: 1000,
    total: 1190,
    paymentMethod: 'cash',
    items: [
      { productName: 'Café', quantity: 1, unitPrice: 1000, taxType: 'IVA_19', taxRate: 0.19, taxAmount: 190 },
    ],
    ...overrides,
  };
}

describe('selectDocumentType', () => {
  it('returns DEE_POS when there is no customer', () => {
    expect(selectDocumentType(null)).toBe('DEE_POS');
  });

  it('returns DEE_POS when the customer has no fiscal docNumber', () => {
    expect(selectDocumentType({ name: 'Juan' })).toBe('DEE_POS');
  });

  it('returns INVOICE when the customer has a fiscal docNumber', () => {
    expect(selectDocumentType({ name: 'Juan', fiscal: { docNumber: '900123456' } })).toBe('INVOICE');
  });
});

describe('buildFiscalPayload', () => {
  it('groups two lines with the same taxType/taxRate into one taxSummary entry', () => {
    const order = baseOrder({
      total: 2380,
      items: [
        { productName: 'Café', quantity: 1, unitPrice: 1000, taxType: 'IVA_19', taxRate: 0.19, taxAmount: 190 },
        { productName: 'Croissant', quantity: 1, unitPrice: 1000, taxType: 'IVA_19', taxRate: 0.19, taxAmount: 190 },
      ],
    });
    const result = buildFiscalPayload({ order, config: baseConfig(), customer: null, now: NOW });
    expect(result.taxSummary).toHaveLength(1);
    expect(result.taxSummary[0]).toEqual({ taxType: 'IVA_19', taxRate: 0.19, taxableAmount: 2000, taxAmount: 380 });
  });

  it('reconciles rounding so subtotal + tax matches order.total exactly', () => {
    const order = baseOrder({
      total: 1786,
      items: [
        { productName: 'A', quantity: 1, unitPrice: 999.5, taxType: 'IVA_19', taxRate: 0.19, taxAmount: 189.905 },
        { productName: 'B', quantity: 1, unitPrice: 500.3, taxType: 'IVA_19', taxRate: 0.19, taxAmount: 95.057 },
      ],
    });
    const result = buildFiscalPayload({ order, config: baseConfig(), customer: null, now: NOW });
    const reconciledSubtotal = result.taxSummary.reduce((sum, g) => sum + g.taxableAmount, 0);
    const reconciledTax = result.taxSummary.reduce((sum, g) => sum + g.taxAmount, 0);
    expect(reconciledSubtotal + reconciledTax).toBe(order.total);
    expect(result.total).toBe(order.total);
  });

  it('builds a "consumidor final" acquirer when there is no customer', () => {
    const result = buildFiscalPayload({ order: baseOrder(), config: baseConfig(), customer: null, now: NOW });
    expect(result.acquirer.docType).toBe('CONSUMIDOR_FINAL');
    expect(result.documentType).toBe('DEE_POS');
  });

  it('maps a client with NIT to an INVOICE acquirer', () => {
    const customer = {
      personType: 'JURIDICA' as const,
      fiscal: { docType: 'NIT', docNumber: '900123456', dv: '7', businessName: 'Café SAS' },
      name: 'Café SAS',
      email: 'facturas@cafesas.com',
    };
    const result = buildFiscalPayload({ order: baseOrder(), config: baseConfig(), customer, now: NOW });
    expect(result.documentType).toBe('INVOICE');
    expect(result.acquirer).toMatchObject({ docType: 'NIT', docNumber: '900123456', dv: '7', name: 'Café SAS' });
  });

  it('does not throw when the issuer is IVA-responsible and the order has IVA_19 lines', () => {
    const result = buildFiscalPayload({
      order: baseOrder(),
      config: baseConfig({ ivaResponsible: true }),
      customer: null,
      now: NOW,
    });
    expect(result.taxSummary.some((g) => g.taxType === 'IVA_19')).toBe(true);
  });

  it('throws when the issuer is not IVA-responsible but the order has IVA_19 lines', () => {
    expect(() =>
      buildFiscalPayload({
        order: baseOrder(),
        config: baseConfig({ ivaResponsible: false }),
        customer: null,
        now: NOW,
      })
    ).toThrow(/IVA_19/);
  });

  it.each([
    ['cash', 'CASH'],
    ['card', 'CARD'],
    ['transfer', 'TRANSFER'],
  ] as const)('maps payment method %s to %s', (input, expected) => {
    const order = baseOrder({ paymentMethod: input });
    const result = buildFiscalPayload({ order, config: baseConfig(), customer: null, now: NOW });
    expect(result.paymentMethod).toBe(expected);
  });

  it('throws when documentType is CREDIT_NOTE without a referencedDocument', () => {
    expect(() =>
      buildFiscalPayload({
        order: baseOrder(),
        config: baseConfig(),
        customer: null,
        documentType: 'CREDIT_NOTE',
        now: NOW,
      })
    ).toThrow(/referencedDocument/);
  });
});
