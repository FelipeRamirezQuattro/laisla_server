import { describe, it, expect } from 'vitest';
import { normalizeOrderItems } from './orderItems';

const base = { quantity: 2, unitPrice: 8000, taxAmount: 1277 };

describe('normalizeOrderItems', () => {
  it('deja intacto un ítem normal y limpia campos de cortesía', () => {
    const r = normalizeOrderItems([{ ...base, originalUnitPrice: 5, complimentaryReason: 'x' }], 'u1');
    expect(r).toEqual({ ok: true, items: [{ ...base, complimentary: false }] });
  });

  it('convierte en cortesía: precio e impuesto a 0 y conserva los originales', () => {
    const r = normalizeOrderItems([{ ...base, complimentary: true, complimentaryReason: ' Invitación ' }], 'u1');
    expect(r).toEqual({
      ok: true,
      items: [
        {
          quantity: 2,
          unitPrice: 0,
          taxAmount: 0,
          complimentary: true,
          complimentaryReason: 'Invitación',
          complimentaryBy: 'u1',
          originalUnitPrice: 8000,
          originalTaxAmount: 1277,
        },
      ],
    });
  });

  it('una cortesía ya existente conserva precio original y autor', () => {
    const r = normalizeOrderItems(
      [{ quantity: 1, unitPrice: 0, taxAmount: 0, complimentary: true, complimentaryReason: 'a', originalUnitPrice: 5000, originalTaxAmount: 800, complimentaryBy: 'u0' }],
      'u1'
    );
    expect(r.ok && r.items[0]).toMatchObject({ originalUnitPrice: 5000, originalTaxAmount: 800, complimentaryBy: 'u0', unitPrice: 0 });
  });

  it('exige motivo y precio original', () => {
    expect(normalizeOrderItems([{ ...base, complimentary: true }], 'u1').ok).toBe(false);
    expect(
      normalizeOrderItems([{ quantity: 1, unitPrice: 0, complimentary: true, complimentaryReason: 'a' }], 'u1').ok
    ).toBe(false);
  });
});
