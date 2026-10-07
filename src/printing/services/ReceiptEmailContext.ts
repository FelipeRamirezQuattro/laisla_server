import type { ReceiptPayload } from './ReceiptPayloadBuilder';

// Colombian peso: "$" prefix, dot as thousands separator, no decimals —
// mirrors print-agent/src/format.ts formatCOP (separate project, kept in
// sync manually, same reasoning as emailService.ts's BRAND constant).
function formatCOP(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  const withThousands = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$${withThousands}`;
}

const PAYMENT_METHOD_LABELS: Record<ReceiptPayload['paymentMethod'], string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  nequi: 'Nequi/Daviplata',
};

export interface ReceiptEmailItemLine {
  name: string;
  detail: string;
  total: string;
}

export interface ReceiptEmailContext {
  businessName: string;
  tradeName?: string;
  idNumber?: string;
  address?: string;
  phone?: string;
  social?: string;
  documentLegend: string;
  saleNumber: string;
  date: string;
  time: string;
  tableLabel: string;
  items: ReceiptEmailItemLine[];
  subtotal: string;
  total: string;
  paymentMethodLabel: string;
}

// Pure: reshapes the same ReceiptPayload already used to print the thermal
// ticket into a Handlebars-ready context — no DB/network access, so the
// email's content can never drift from what the printed ticket shows.
export function buildOrderReceiptEmailContext(payload: ReceiptPayload): ReceiptEmailContext {
  return {
    businessName: payload.header.businessName,
    tradeName: payload.header.tradeName,
    idNumber: payload.header.idNumber,
    address: payload.header.address,
    phone: payload.header.phone,
    social: payload.header.social,
    documentLegend: payload.documentLegend,
    saleNumber: payload.saleNumber,
    date: payload.date,
    time: payload.time,
    tableLabel: payload.tableLabel,
    items: payload.items.map((item) => ({
      name: item.variantSize ? `${item.productName} (${item.variantSize})` : item.productName,
      detail: `${item.quantity} x ${formatCOP(item.unitPrice)}`,
      total: formatCOP(item.total),
    })),
    subtotal: formatCOP(payload.subtotal),
    total: formatCOP(payload.total),
    paymentMethodLabel: PAYMENT_METHOD_LABELS[payload.paymentMethod],
  };
}
