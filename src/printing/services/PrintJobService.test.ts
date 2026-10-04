import { describe, expect, it } from 'vitest';
import { decideStaleClaimOutcome, shouldAutoPrintReceipt, shouldCreateKitchenJob } from './PrintJobService';

describe('shouldAutoPrintReceipt', () => {
  it('defaults to true when PrintConfig has not been created yet', () => {
    expect(shouldAutoPrintReceipt(null)).toBe(true);
  });

  it('respects an explicit false', () => {
    expect(shouldAutoPrintReceipt({ receiptAutoPrint: false })).toBe(false);
  });

  it('respects an explicit true', () => {
    expect(shouldAutoPrintReceipt({ receiptAutoPrint: true })).toBe(true);
  });
});

describe('shouldCreateKitchenJob', () => {
  it('is false when the switch is off, even with an active BARRA printer', () => {
    expect(shouldCreateKitchenJob({ kitchenPrintingEnabled: false }, true)).toBe(false);
  });

  it('is false when the switch is on but there is no active BARRA printer', () => {
    expect(shouldCreateKitchenJob({ kitchenPrintingEnabled: true }, false)).toBe(false);
  });

  it('is false when PrintConfig has not been created yet, regardless of printers', () => {
    expect(shouldCreateKitchenJob(null, true)).toBe(false);
  });

  it('is true only when the switch is on AND a BARRA printer is active', () => {
    expect(shouldCreateKitchenJob({ kitchenPrintingEnabled: true }, true)).toBe(true);
  });
});

describe('decideStaleClaimOutcome', () => {
  it('requeues to PENDING while attempts remain below the max', () => {
    const decision = decideStaleClaimOutcome({ attempts: 0 }, 3);
    expect(decision).toEqual({ nextStatus: 'PENDING', nextAttempts: 1 });
  });

  it('marks FAILED once attempts reach the max', () => {
    const decision = decideStaleClaimOutcome({ attempts: 2 }, 3);
    expect(decision).toEqual({ nextStatus: 'FAILED', nextAttempts: 3 });
  });

  it('marks FAILED and never exceeds the max further', () => {
    const decision = decideStaleClaimOutcome({ attempts: 5 }, 3);
    expect(decision.nextStatus).toBe('FAILED');
  });
});
