import { describe, expect, it } from 'vitest';
import { buildOrderReceiptEmailContext } from './ReceiptEmailContext';
import type { ReceiptPayload } from './ReceiptPayloadBuilder';

const basePayload: ReceiptPayload = {
  documentLegend: 'Comprobante de pago',
  header: {
    businessName: 'La Isla - Café Picnic',
    idNumber: '1110537522',
    phone: '3045270892',
    social: '@laislacafepicnic',
  },
  saleNumber: '99439011',
  date: '2026-10-07',
  time: '14:05:30',
  tableLabel: 'Mesa 4',
  items: [
    { productName: 'Latte', variantSize: '12oz', quantity: 2, unitPrice: 8000, total: 16000 },
    { productName: 'Croissant', quantity: 1, unitPrice: 6000, total: 6000 },
  ],
  subtotal: 22000,
  taxSummary: [],
  total: 22000,
  paymentMethod: 'cash',
  footer: '¡Gracias por tu visita!',
  openDrawerOnCash: true,
};

describe('buildOrderReceiptEmailContext', () => {
  it('carries the business header through unchanged', () => {
    const context = buildOrderReceiptEmailContext(basePayload);
    expect(context.businessName).toBe('La Isla - Café Picnic');
    expect(context.idNumber).toBe('1110537522');
    expect(context.phone).toBe('3045270892');
    expect(context.social).toBe('@laislacafepicnic');
  });

  it('carries sale number, date/time and table label through unchanged', () => {
    const context = buildOrderReceiptEmailContext(basePayload);
    expect(context.saleNumber).toBe('99439011');
    expect(context.date).toBe('2026-10-07');
    expect(context.time).toBe('14:05:30');
    expect(context.tableLabel).toBe('Mesa 4');
  });

  it('formats each item as a name, a quantity-x-price detail line, and a formatted total', () => {
    const context = buildOrderReceiptEmailContext(basePayload);
    expect(context.items).toEqual([
      { name: 'Latte (12oz)', detail: '2 x $8.000', total: '$16.000' },
      { name: 'Croissant', detail: '1 x $6.000', total: '$6.000' },
    ]);
  });

  it('formats subtotal and total as COP strings', () => {
    const context = buildOrderReceiptEmailContext(basePayload);
    expect(context.subtotal).toBe('$22.000');
    expect(context.total).toBe('$22.000');
  });

  it.each([
    ['cash', 'Efectivo'],
    ['card', 'Tarjeta'],
    ['transfer', 'Transferencia'],
    ['nequi', 'Nequi/Daviplata'],
  ] as const)('labels payment method %s as %s', (paymentMethod, label) => {
    const context = buildOrderReceiptEmailContext({ ...basePayload, paymentMethod });
    expect(context.paymentMethodLabel).toBe(label);
  });
});
