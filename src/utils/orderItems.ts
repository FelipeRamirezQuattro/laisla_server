export interface OrderItemInput {
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  complimentary?: boolean;
  originalUnitPrice?: number;
  originalTaxAmount?: number;
  complimentaryReason?: string;
  complimentaryBy?: string;
  [key: string]: unknown;
}

export type NormalizeItemsResult<T> = { ok: true; items: T[] } | { ok: false; error: string };

// Las cortesías se normalizan en el servidor: el precio cobrado es siempre 0
// y se conserva el original para reportes y para poder revertir. Cantidad,
// producto y variante no cambian, por eso el inventario se descuenta igual.
export function normalizeOrderItems<T extends OrderItemInput>(items: T[], userId: string): NormalizeItemsResult<T> {
  const normalized: T[] = [];
  for (const item of items) {
    if (!item.complimentary) {
      const { originalUnitPrice, originalTaxAmount, complimentaryReason, complimentaryBy, ...rest } = item;
      void originalUnitPrice; void originalTaxAmount; void complimentaryReason; void complimentaryBy;
      normalized.push({ ...rest, complimentary: false } as unknown as T);
      continue;
    }

    const reason = typeof item.complimentaryReason === 'string' ? item.complimentaryReason.trim() : '';
    if (!reason) return { ok: false, error: 'La cortesía requiere un motivo' };

    const originalUnitPrice = item.originalUnitPrice ?? (item.unitPrice > 0 ? item.unitPrice : undefined);
    if (originalUnitPrice === undefined || !(originalUnitPrice >= 0)) {
      return { ok: false, error: 'La cortesía requiere el precio original del producto' };
    }

    normalized.push({
      ...item,
      complimentary: true,
      complimentaryReason: reason,
      complimentaryBy: item.complimentaryBy ?? userId,
      originalUnitPrice,
      originalTaxAmount: item.originalTaxAmount ?? item.taxAmount ?? 0,
      unitPrice: 0,
      taxAmount: 0,
    });
  }
  return { ok: true, items: normalized };
}
