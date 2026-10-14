export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'nequi'] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export interface OrderPayment {
  method: PaymentMethodValue;
  amount: number;
}

export interface OrderPaymentsSource {
  total: number;
  paymentMethod?: string | null;
  payments?: { method: string; amount: number }[] | null;
}

// Amounts are COP, so anything under half a peso is rounding noise.
const TOLERANCE = 0.5;

function isMethod(value: unknown): value is PaymentMethodValue {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value);
}

// Pedidos facturados antes de los pagos divididos solo tienen `paymentMethod`;
// se tratan como un único pago por el total.
export function getOrderPayments(order: OrderPaymentsSource): OrderPayment[] {
  if (order.payments && order.payments.length > 0) {
    return order.payments
      .filter((p) => isMethod(p.method))
      .map((p) => ({ method: p.method as PaymentMethodValue, amount: p.amount }));
  }
  if (isMethod(order.paymentMethod)) {
    return [{ method: order.paymentMethod, amount: order.total }];
  }
  return [];
}

export type PaymentsValidation =
  | { ok: true; payments: OrderPayment[] }
  | { ok: false; error: string };

// Valida y normaliza (fusiona métodos repetidos). La suma debe cuadrar con el total.
export function validatePayments(input: unknown, total: number): PaymentsValidation {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: 'Debe indicar al menos un método de pago' };
  }

  const merged = new Map<PaymentMethodValue, number>();
  for (const raw of input) {
    const method = raw?.method;
    const amount = Number(raw?.amount);
    if (!isMethod(method)) {
      return { ok: false, error: `Método de pago inválido: ${String(method)}` };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Cada pago debe tener un monto mayor a 0' };
    }
    merged.set(method, (merged.get(method) ?? 0) + amount);
  }

  const payments = [...merged.entries()].map(([method, amount]) => ({ method, amount }));
  const sum = payments.reduce((acc, p) => acc + p.amount, 0);
  if (Math.abs(sum - total) > TOLERANCE) {
    return { ok: false, error: `La suma de los pagos (${sum}) no coincide con el total (${total})` };
  }
  return { ok: true, payments };
}

// Valor de compatibilidad para el campo legado `paymentMethod`.
export function derivePaymentMethod(payments: OrderPayment[]): PaymentMethodValue | 'mixed' | null {
  if (payments.length === 0) return null;
  return payments.length === 1 ? payments[0].method : 'mixed';
}

// Para consumidores que solo admiten un método (DIAN, ticket): el de mayor monto.
export function getPrimaryPaymentMethod(order: OrderPaymentsSource): PaymentMethodValue | undefined {
  const payments = getOrderPayments(order);
  if (payments.length === 0) return undefined;
  return payments.reduce((best, p) => (p.amount > best.amount ? p : best)).method;
}
