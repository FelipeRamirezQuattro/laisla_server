import { describe, expect, it } from 'vitest';
import { clientToMapperCustomer, orderToMapperOrder } from './FiscalDocumentService';

describe('clientToMapperCustomer', () => {
  it('returns null when there is no client', () => {
    expect(clientToMapperCustomer(null)).toBeNull();
  });

  it('maps a client with fiscal data through', () => {
    const client = {
      name: 'Café SAS',
      email: 'facturas@cafesas.com',
      fiscal: { docType: 'NIT', docNumber: '900123456', dv: '7', businessName: 'Café SAS', personType: 'JURIDICA' as const },
    };
    expect(clientToMapperCustomer(client)).toEqual({
      personType: 'JURIDICA',
      fiscal: { docType: 'NIT', docNumber: '900123456', dv: '7', businessName: 'Café SAS', fiscalEmail: undefined },
      name: 'Café SAS',
      email: 'facturas@cafesas.com',
    });
  });

  it('maps a client without fiscal data (treated as consumidor final upstream)', () => {
    const client = { name: 'Juan Walk-in', email: '' };
    expect(clientToMapperCustomer(client)).toEqual({
      personType: 'NATURAL',
      fiscal: undefined,
      name: 'Juan Walk-in',
      email: '',
    });
  });
});

describe('orderToMapperOrder', () => {
  it('maps an order-like document into the mapper shape', () => {
    const order = {
      _id: { toString: () => 'order-1' },
      subtotal: 1000,
      total: 1190,
      paymentMethod: 'cash' as const,
      items: [
        { productName: 'Café', quantity: 1, unitPrice: 1000, taxType: 'IVA_19' as const, taxRate: 0.19, taxAmount: 190 },
      ],
    };
    expect(orderToMapperOrder(order)).toEqual({
      _id: 'order-1',
      subtotal: 1000,
      total: 1190,
      paymentMethod: 'cash',
      items: [{ productName: 'Café', quantity: 1, unitPrice: 1000, taxType: 'IVA_19', taxRate: 0.19, taxAmount: 190 }],
    });
  });
});
