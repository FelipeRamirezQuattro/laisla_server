import { describe, expect, it } from 'vitest';
import { computeNextOccurrence } from './recurrence';

describe('computeNextOccurrence', () => {
  const monday = new Date(2026, 8, 28, 15, 45);

  it('returns the next day at the start of day for daily recurrence', () => {
    expect(computeNextOccurrence({ frequency: 'daily' }, monday)).toEqual(
      new Date(2026, 8, 29, 0, 0, 0, 0)
    );
  });

  it('selects the next configured weekday', () => {
    expect(computeNextOccurrence({ frequency: 'weekly', daysOfWeek: [1, 3] }, monday)).toEqual(
      new Date(2026, 8, 30, 0, 0, 0, 0)
    );
  });

  it('uses the same weekday next week when weekly days are omitted', () => {
    expect(computeNextOccurrence({ frequency: 'weekly' }, monday)).toEqual(
      new Date(2026, 9, 5, 0, 0, 0, 0)
    );
  });

  it('clamps monthly recurrence to the last day of a shorter month', () => {
    const january31 = new Date(2026, 0, 31, 12);
    expect(computeNextOccurrence({ frequency: 'monthly', dayOfMonth: 31 }, january31)).toEqual(
      new Date(2026, 1, 28, 0, 0, 0, 0)
    );
  });

  it('uses at least one day for a custom interval', () => {
    expect(computeNextOccurrence({ frequency: 'custom', interval: 0 }, monday)).toEqual(
      new Date(2026, 8, 29, 0, 0, 0, 0)
    );
    expect(computeNextOccurrence({ frequency: 'custom', interval: 10 }, monday)).toEqual(
      new Date(2026, 9, 8, 0, 0, 0, 0)
    );
  });
});
