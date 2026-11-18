import { describe, expect, it } from 'vitest';
import { isRestrictedExpenseType, parseExpenseType } from './expenseTypes';

describe('parseExpenseType', () => {
  it('acepta los cuatro tipos', () => {
    for (const t of ['INSUMO', 'OTRO', 'MANO_OBRA', 'GIF']) expect(parseExpenseType(t)).toBe(t);
  });
  it('sin tipo se asume gasto general', () => {
    expect(parseExpenseType(undefined)).toBe('OTRO');
    expect(parseExpenseType('')).toBe('OTRO');
  });
  it('un tipo desconocido se rechaza (no cae en OTRO)', () => {
    expect(parseExpenseType('NOMINA')).toBeNull();
    expect(parseExpenseType('gif')).toBeNull();
  });
});

describe('isRestrictedExpenseType', () => {
  it('solo mano de obra y GIF son restringidos', () => {
    expect(isRestrictedExpenseType('MANO_OBRA')).toBe(true);
    expect(isRestrictedExpenseType('GIF')).toBe(true);
    expect(isRestrictedExpenseType('OTRO')).toBe(false);
    expect(isRestrictedExpenseType('INSUMO')).toBe(false);
  });
});
