import { describe, expect, it } from 'vitest';
import {
  buildKitchenOrderPayload,
  buildReceiptPayload,
  buildTestPrintPayload,
  splitIntoColumns,
} from './ReceiptPayloadBuilder';

const baseOrder = {
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  items: [
    { productName: 'Latte', variantSize: '12oz', quantity: 2, unitPrice: 8000 },
    { productName: 'Croissant', quantity: 1, unitPrice: 6000 },
  ],
  subtotal: 22000,
  total: 22000,
  paymentMethod: 'cash' as const,
  at: new Date('2026-09-30T14:05:30.000Z'),
};

const printConfig = {
  headerText: 'La Isla Café Picnic',
  footerText: '¡Gracias por tu visita!',
  openDrawerOnCash: true,
  businessNit: '1110537522',
  businessPhone: '3045270892',
  businessSocial: '@laislacafepicnic',
};

describe('splitIntoColumns', () => {
  it('splits a long string into fixed-width chunks', () => {
    expect(splitIntoColumns('a'.repeat(100), 48)).toEqual(['a'.repeat(48), 'a'.repeat(48), 'a'.repeat(4)]);
  });

  it('returns an empty array for an empty string', () => {
    expect(splitIntoColumns('', 48)).toEqual([]);
  });
});

describe('buildReceiptPayload — without a fiscal document', () => {
  it('falls back to PrintConfig header/footer and a generic "Comprobante de pago" legend', () => {
    const payload = buildReceiptPayload({
      order: baseOrder,
      table: { isWalkIn: false, tableName: '4' },
      fiscalDocument: null,
      printConfig,
    });

    expect(payload.documentLegend).toBe('Comprobante de pago');
    expect(payload.header).toEqual({
      businessName: 'La Isla Café Picnic',
      idNumber: '1110537522',
      phone: '3045270892',
      social: '@laislacafepicnic',
    });
    expect(payload.fiscal).toBeUndefined();
    expect(payload.tableLabel).toBe('Mesa 4');
    expect(payload.saleNumber).toBe('99439011');
    expect(payload.subtotal).toBe(22000);
    expect(payload.total).toBe(22000);
    expect(payload.items).toEqual([
      { productName: 'Latte', variantSize: '12oz', quantity: 2, unitPrice: 8000, total: 16000 },
      { productName: 'Croissant', variantSize: undefined, quantity: 1, unitPrice: 6000, total: 6000 },
    ]);
  });

  it('labels a walk-in order as "Para llevar"', () => {
    const payload = buildReceiptPayload({
      order: baseOrder,
      table: { isWalkIn: true },
      fiscalDocument: null,
      printConfig,
    });
    expect(payload.tableLabel).toBe('Para llevar');
  });

  it('computes change for a cash payment when amountReceived is given', () => {
    const payload = buildReceiptPayload({
      order: baseOrder,
      table: { isWalkIn: true },
      fiscalDocument: null,
      printConfig,
      amountReceived: 25000,
    });
    expect(payload.amountReceived).toBe(25000);
    expect(payload.change).toBe(3000);
  });

  it('omits amountReceived/change for a non-cash payment even if given', () => {
    const payload = buildReceiptPayload({
      order: { ...baseOrder, paymentMethod: 'card' },
      table: { isWalkIn: true },
      fiscalDocument: null,
      printConfig,
      amountReceived: 25000,
    });
    expect(payload.amountReceived).toBeUndefined();
    expect(payload.change).toBeUndefined();
  });

  it('carries PrintConfig.openDrawerOnCash through by default', () => {
    const payload = buildReceiptPayload({
      order: baseOrder,
      table: { isWalkIn: true },
      fiscalDocument: null,
      printConfig,
    });
    expect(payload.openDrawerOnCash).toBe(true);
  });

  it('forces openDrawerOnCash to false when allowCashDrawer is false (reprints)', () => {
    const payload = buildReceiptPayload({
      order: baseOrder,
      table: { isWalkIn: true },
      fiscalDocument: null,
      printConfig,
      allowCashDrawer: false,
    });
    expect(payload.openDrawerOnCash).toBe(false);
  });

  it('never opens the drawer when PrintConfig has it off, even with allowCashDrawer true', () => {
    const payload = buildReceiptPayload({
      order: baseOrder,
      table: { isWalkIn: true },
      fiscalDocument: null,
      printConfig: { ...printConfig, openDrawerOnCash: false },
    });
    expect(payload.openDrawerOnCash).toBe(false);
  });
});

describe('buildReceiptPayload — with a fiscal document', () => {
  const fiscalDocument = {
    type: 'DEE_POS' as const,
    status: 'ACCEPTED' as const,
    prefix: 'POS',
    number: 42,
    cude: 'a'.repeat(96),
    qrData: 'https://catalogo-vpfe.dian.gov.co/document/search?documentkey=abc',
    issuerSnapshot: {
      businessName: 'La Isla Café Picnic SAS',
      tradeName: 'La Isla Café Picnic',
      idNumber: '900123456',
      address: 'Cra 1 # 2-34, Ibagué',
    },
    totalsSnapshot: {
      subtotal: 22000,
      total: 22000,
      taxSummary: [{ taxType: 'IVA_19', taxRate: 19, taxableAmount: 18487, taxAmount: 3513 }],
    },
  };

  it('prefers the fiscal issuer/prefix/totals over PrintConfig and Order', () => {
    const payload = buildReceiptPayload({
      order: baseOrder,
      table: { isWalkIn: false, tableName: '4' },
      fiscalDocument,
      printConfig,
    });

    expect(payload.documentLegend).toBe('Documento equivalente POS');
    expect(payload.header.businessName).toBe('La Isla Café Picnic SAS');
    expect(payload.saleNumber).toBe('POS42');
    expect(payload.taxSummary).toEqual(fiscalDocument.totalsSnapshot.taxSummary);
    expect(payload.fiscal?.isContingency).toBe(false);
  });

  it('still carries phone/social from PrintConfig even though the fiscal issuer snapshot has none', () => {
    const payload = buildReceiptPayload({
      order: baseOrder,
      table: { isWalkIn: false, tableName: '4' },
      fiscalDocument,
      printConfig,
    });

    expect(payload.header.phone).toBe('3045270892');
    expect(payload.header.social).toBe('@laislacafepicnic');
  });

  it('splits the CUDE into 48-column lines and flags contingency', () => {
    const payload = buildReceiptPayload({
      order: baseOrder,
      table: { isWalkIn: true },
      fiscalDocument: { ...fiscalDocument, status: 'CONTINGENCY' },
      printConfig,
    });

    expect(payload.fiscal?.cudeLines).toHaveLength(2);
    expect(payload.fiscal?.cudeLines[0]).toHaveLength(48);
    expect(payload.fiscal?.isContingency).toBe(true);
  });
});

describe('buildKitchenOrderPayload', () => {
  it('never includes prices and uses the order-level notes field', () => {
    const payload = buildKitchenOrderPayload({
      order: { ...baseOrder, notes: 'Sin azúcar' },
      table: { isWalkIn: false, tableName: '7' },
    });

    expect(payload.tableLabel).toBe('Mesa 7');
    expect(payload.notes).toBe('Sin azúcar');
    expect(payload.items).toEqual([
      { productName: 'Latte', variantSize: '12oz', quantity: 2 },
      { productName: 'Croissant', variantSize: undefined, quantity: 1 },
    ]);
    expect(payload.items.some((item: any) => 'unitPrice' in item)).toBe(false);
  });
});

describe('buildTestPrintPayload', () => {
  it('includes the printer name, connection label and a sample QR', () => {
    const payload = buildTestPrintPayload({ printerName: 'Caja', connectionLabel: '192.168.1.50:9100', at: baseOrder.at });
    expect(payload.printerName).toBe('Caja');
    expect(payload.connectionLabel).toBe('192.168.1.50:9100');
    expect(payload.sampleQrData).toBeTruthy();
  });

  it('accepts a local path as the connection label for a USB printer', () => {
    const payload = buildTestPrintPayload({ printerName: 'Caja', connectionLabel: '\\\\.\\COM3', at: baseOrder.at });
    expect(payload.connectionLabel).toBe('\\\\.\\COM3');
  });
});
