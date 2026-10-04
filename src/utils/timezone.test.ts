import { describe, expect, it } from 'vitest';
import { formatLocalDate, formatLocalTime } from './timezone';

describe('formatLocalDate', () => {
  it('formats a localNow-style Date (UTC fields = Bogota clock) as yyyy-MM-dd', () => {
    const date = new Date(Date.UTC(2026, 8, 29, 21, 5, 30));
    expect(formatLocalDate(date)).toBe('2026-09-29');
  });
});

describe('formatLocalTime', () => {
  it('formats a localNow-style Date (UTC fields = Bogota clock) as HH:mm:ss', () => {
    const date = new Date(Date.UTC(2026, 8, 29, 21, 5, 30));
    expect(formatLocalTime(date)).toBe('21:05:30');
  });
});
