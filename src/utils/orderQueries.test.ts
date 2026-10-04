import { describe, expect, it } from 'vitest';
import { getBilledOrderMatch } from './orderQueries';

describe('getBilledOrderMatch', () => {
  it('matches closed billed orders and delivered paid orders', () => {
    expect(getBilledOrderMatch()).toEqual({
      $or: [
        { status: 'billed' },
        { status: 'delivered', paymentMethod: { $ne: null }, closedAt: { $ne: null } }
      ]
    });
  });

  it('adds an inclusive date range using closedAt by default', () => {
    const start = new Date('2026-09-01T00:00:00Z');
    const end = new Date('2026-09-30T23:59:59Z');
    expect(getBilledOrderMatch({ start, end })).toMatchObject({
      closedAt: { $gte: start, $lte: end }
    });
  });

  it('supports a custom date field and one-sided ranges', () => {
    const start = new Date('2026-09-01T00:00:00Z');
    expect(getBilledOrderMatch({ field: 'createdAt', start })).toMatchObject({
      createdAt: { $gte: start }
    });
  });
});
