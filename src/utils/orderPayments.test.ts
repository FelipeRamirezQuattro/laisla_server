import { describe, it, expect } from 'vitest';
import { getOrderPayments, validatePayments, derivePaymentMethod } from './orderPayments';

describe('getOrderPayments', () => {
  it('cae al paymentMethod legado por el total', () => {
    expect(getOrderPayments({ total: 100, paymentMethod: 'cash' })).toEqual([{ method: 'cash', amount: 100 }]);
  });
  it('usa payments cuando existen', () => {
    const payments = [{ method: 'cash', amount: 40 }, { method: 'card', amount: 60 }];
    expect(getOrderPayments({ total: 100, paymentMethod: 'mixed', payments })).toEqual(payments);
  });
  it('devuelve vacío sin pago', () => {
    expect(getOrderPayments({ total: 100, paymentMethod: null })).toEqual([]);
  });
});

describe('validatePayments', () => {
  it('acepta pagos que suman el total', () => {
    const r = validatePayments([{ method: 'cash', amount: 40 }, { method: 'nequi', amount: 60 }], 100);
    expect(r.ok).toBe(true);
  });
  it('fusiona métodos repetidos', () => {
    const r = validatePayments([{ method: 'cash', amount: 40 }, { method: 'cash', amount: 60 }], 100);
    expect(r).toEqual({ ok: true, payments: [{ method: 'cash', amount: 100 }] });
  });
  it('rechaza suma distinta', () => {
    expect(validatePayments([{ method: 'cash', amount: 90 }], 100).ok).toBe(false);
  });
  it('rechaza método inválido, monto no positivo y lista vacía', () => {
    expect(validatePayments([{ method: 'bitcoin', amount: 100 }], 100).ok).toBe(false);
    expect(validatePayments([{ method: 'cash', amount: 0 }], 0).ok).toBe(false);
    expect(validatePayments([], 100).ok).toBe(false);
  });
});

describe('derivePaymentMethod', () => {
  it('single, mixed y null', () => {
    expect(derivePaymentMethod([{ method: 'card', amount: 1 }])).toBe('card');
    expect(derivePaymentMethod([{ method: 'card', amount: 1 }, { method: 'cash', amount: 1 }])).toBe('mixed');
    expect(derivePaymentMethod([])).toBeNull();
  });
});
