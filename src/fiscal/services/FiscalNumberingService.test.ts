import { describe, expect, it } from 'vitest';
import { pickNextNumber } from './FiscalNumberingService';
import type { INumberingResolution } from '../models/FiscalConfig';

function resolution(overrides: Partial<INumberingResolution> = {}): INumberingResolution {
  return {
    documentType: 'DEE_POS',
    prefix: 'DPOS',
    rangeFrom: 1,
    rangeTo: 1000,
    currentNumber: 0,
    resolutionNumber: '18760000001',
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2027-01-01'),
    ...overrides,
  };
}

describe('pickNextNumber', () => {
  it('returns the next number in sequence for the matching document type', () => {
    const result = pickNextNumber([resolution({ currentNumber: 5 })], 'DEE_POS');
    expect(result).toEqual({ prefix: 'DPOS', number: 6 });
  });

  it('returns null when no resolution matches the document type', () => {
    const result = pickNextNumber([resolution({ documentType: 'INVOICE' })], 'DEE_POS');
    expect(result).toBeNull();
  });

  it('returns null when the range is exhausted', () => {
    const result = pickNextNumber([resolution({ currentNumber: 1000, rangeTo: 1000 })], 'DEE_POS');
    expect(result).toBeNull();
  });

  it('returns null for CREDIT_NOTE when there is no dedicated resolution (credit notes are unnumbered in Fase 2)', () => {
    const result = pickNextNumber([resolution({ documentType: 'DEE_POS' })], 'CREDIT_NOTE');
    expect(result).toBeNull();
  });

  it('picks the first matching resolution that still has range left, skipping an exhausted one', () => {
    const exhausted = resolution({ currentNumber: 1000, rangeTo: 1000, prefix: 'OLD' });
    const active = resolution({ currentNumber: 0, rangeTo: 1000, prefix: 'NEW' });
    const result = pickNextNumber([exhausted, active], 'DEE_POS');
    expect(result).toEqual({ prefix: 'NEW', number: 1 });
  });
});
