/**
 * Match predicate for "billed" orders — an order counts as billed once it's
 * either fully closed (`status: 'billed'`) or delivered-and-paid but not yet
 * formally closed. Shared by the dashboard summary and the sales/products
 * reports so all revenue figures use the same definition of "sold".
 */
export function getBilledOrderMatch(dateRange?: {
  field?: string;
  start?: Date;
  end?: Date;
}): Record<string, unknown> {
  const match: Record<string, unknown> = {
    $or: [
      { status: 'billed' },
      { status: 'delivered', paymentMethod: { $ne: null }, closedAt: { $ne: null } },
    ],
  };

  if (dateRange?.start || dateRange?.end) {
    const field = dateRange.field ?? 'closedAt';
    const filter: Record<string, Date> = {};
    if (dateRange.start) filter.$gte = dateRange.start;
    if (dateRange.end) filter.$lte = dateRange.end;
    match[field] = filter;
  }

  return match;
}
