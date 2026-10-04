import { describe, expect, it } from 'vitest';
import { MAX_FISCAL_ATTEMPTS, calculateNextAttemptAt, calculateNextAttemptDelayMs } from './FiscalBackoff';

describe('calculateNextAttemptDelayMs', () => {
  it('doubles the delay for each successive attempt', () => {
    expect(calculateNextAttemptDelayMs(1)).toBe(60_000);
    expect(calculateNextAttemptDelayMs(2)).toBe(120_000);
    expect(calculateNextAttemptDelayMs(3)).toBe(240_000);
  });

  it('caps the delay at 30 minutes', () => {
    expect(calculateNextAttemptDelayMs(10)).toBe(30 * 60_000);
  });
});

describe('calculateNextAttemptAt', () => {
  it('adds the backoff delay to the given now', () => {
    const now = new Date('2026-09-30T00:00:00.000Z');
    const result = calculateNextAttemptAt(1, now);
    expect(result.toISOString()).toBe('2026-09-30T00:01:00.000Z');
  });
});

describe('MAX_FISCAL_ATTEMPTS', () => {
  it('is a positive integer used to decide when a document moves to CONTINGENCY', () => {
    expect(MAX_FISCAL_ATTEMPTS).toBeGreaterThan(0);
  });
});
