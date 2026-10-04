import { formatLocalDate, formatLocalTime } from '../../utils/timezone';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'nequi';

export interface ReceiptOrderItemInput {
  productName: string;
  variantSize?: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptOrderInput {
  _id: { toString(): string };
  items: ReceiptOrderItemInput[];
  subtotal: number;
  total: number;
  paymentMethod?: PaymentMethod;
  // Moment printed as "fecha y hora" — the order's billedAt for a fresh
  // receipt, or the current time for a reprint.
  at: Date;
}

export interface ReceiptTaxSummaryLine {
  taxType: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface ReceiptFiscalDocumentInput {
  type: 'DEE_POS' | 'INVOICE' | 'CREDIT_NOTE';
  status: 'PENDING' | 'SENDING' | 'ACCEPTED' | 'REJECTED' | 'ERROR' | 'CONTINGENCY';
  prefix?: string;
  number?: number;
  cude?: string;
  qrData?: string;
  issuerSnapshot: {
    businessName: string;
    tradeName?: string;
    idNumber: string;
    address?: string;
  };
  totalsSnapshot: {
    subtotal: number;
    total: number;
    taxSummary: ReceiptTaxSummaryLine[];
  };
}

export interface ReceiptPrintConfigInput {
  headerText: string;
  footerText: string;
  openDrawerOnCash: boolean;
  businessNit?: string;
  businessPhone?: string;
  businessSocial?: string;
}

export interface ReceiptTableInput {
  isWalkIn: boolean;
  tableName?: string;
}

export interface ReceiptPayloadItem {
  productName: string;
  variantSize?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptPayloadFiscal {
  cude?: string;
  cudeLines: string[];
  qrData?: string;
  isContingency: boolean;
}

export interface ReceiptPayload {
  documentLegend: string;
  header: {
    businessName: string;
    tradeName?: string;
    idNumber?: string;
    address?: string;
    phone?: string;
    social?: string;
  };
  saleNumber: string;
  date: string;
  time: string;
  tableLabel: string;
  items: ReceiptPayloadItem[];
  subtotal: number;
  taxSummary: ReceiptTaxSummaryLine[];
  total: number;
  paymentMethod: PaymentMethod;
  amountReceived?: number;
  change?: number;
  fiscal?: ReceiptPayloadFiscal;
  footer: string;
  // Decided server-side (never by the agent) so the agent only has to check
  // this flag + its own printer.hasCashDrawer. Always false for reprints —
  // a reprint never opens the drawer, no matter what PrintConfig says.
  openDrawerOnCash: boolean;
}

export interface KitchenOrderItemPayload {
  productName: string;
  variantSize?: string;
  quantity: number;
}

export interface KitchenOrderPayload {
  orderNumber: string;
  tableLabel: string;
  time: string;
  items: KitchenOrderItemPayload[];
  notes?: string;
}

export interface TestPrintPayload {
  printerName: string;
  ip: string;
  date: string;
  time: string;
  sampleQrData: string;
}

// Pure: splits a long string (e.g. a CUDE) into fixed-width chunks so it
// prints cleanly on a narrow thermal roll instead of wrapping mid-character.
export function splitIntoColumns(value: string, columns: number): string[] {
  if (!value) return [];
  const lines: string[] = [];
  for (let i = 0; i < value.length; i += columns) {
    lines.push(value.slice(i, i + columns));
  }
  return lines;
}

function buildTableLabel(table: ReceiptTableInput): string {
  if (table.isWalkIn) return 'Para llevar';
  return `Mesa ${table.tableName ?? ''}`.trim();
}

// Pure: assembles everything the print-agent needs to render a cash-register
// receipt, with no network/DB access of its own. When a fiscal document is
// supplied its issuer/tax/CUDE data takes precedence over PrintConfig's
// generic header/footer and the order's own totals — see the plan's
// "extension point" for when the fiscal module is absent.
export function buildReceiptPayload(input: {
  order: ReceiptOrderInput;
  table: ReceiptTableInput;
  fiscalDocument?: ReceiptFiscalDocumentInput | null;
  printConfig: ReceiptPrintConfigInput;
  amountReceived?: number;
  columns?: number;
  // False for reprints regardless of PrintConfig.openDrawerOnCash.
  allowCashDrawer?: boolean;
}): ReceiptPayload {
  const columns = input.columns ?? 48;
  const allowCashDrawer = input.allowCashDrawer ?? true;
  const { order, table, fiscalDocument, printConfig } = input;

  const header = fiscalDocument
    ? {
        businessName: fiscalDocument.issuerSnapshot.businessName,
        tradeName: fiscalDocument.issuerSnapshot.tradeName,
        idNumber: fiscalDocument.issuerSnapshot.idNumber,
        address: fiscalDocument.issuerSnapshot.address,
        phone: printConfig.businessPhone,
        social: printConfig.businessSocial,
      }
    : {
        businessName: printConfig.headerText,
        idNumber: printConfig.businessNit,
        phone: printConfig.businessPhone,
        social: printConfig.businessSocial,
      };

  const documentLegend = fiscalDocument
    ? fiscalDocument.type === 'INVOICE'
      ? 'Factura de venta'
      : 'Documento equivalente POS'
    : 'Comprobante de pago';

  const saleNumber =
    fiscalDocument?.prefix && fiscalDocument?.number
      ? `${fiscalDocument.prefix}${fiscalDocument.number}`
      : order._id.toString().slice(-8).toUpperCase();

  const items = order.items.map((item) => ({
    productName: item.productName,
    variantSize: item.variantSize,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.quantity * item.unitPrice,
  }));

  const subtotal = fiscalDocument?.totalsSnapshot.subtotal ?? order.subtotal;
  const total = fiscalDocument?.totalsSnapshot.total ?? order.total;
  const taxSummary = fiscalDocument?.totalsSnapshot.taxSummary ?? [];

  const paymentMethod = order.paymentMethod ?? 'cash';
  const amountReceived = paymentMethod === 'cash' ? input.amountReceived : undefined;
  const change = amountReceived !== undefined ? Math.max(amountReceived - total, 0) : undefined;

  const fiscal: ReceiptPayloadFiscal | undefined = fiscalDocument
    ? {
        cude: fiscalDocument.cude,
        cudeLines: splitIntoColumns(fiscalDocument.cude ?? '', columns),
        qrData: fiscalDocument.qrData,
        isContingency: fiscalDocument.status === 'CONTINGENCY',
      }
    : undefined;

  return {
    documentLegend,
    header,
    saleNumber,
    date: formatLocalDate(order.at),
    time: formatLocalTime(order.at),
    tableLabel: buildTableLabel(table),
    items,
    subtotal,
    taxSummary,
    total,
    paymentMethod,
    amountReceived,
    change,
    fiscal,
    footer: printConfig.footerText,
    openDrawerOnCash: allowCashDrawer && printConfig.openDrawerOnCash,
  };
}

export interface KitchenOrderInput {
  _id: { toString(): string };
  items: Array<{ productName: string; variantSize?: string; quantity: number }>;
  notes?: string;
  at: Date;
}

// Pure: comandas never show prices, and item "notes" are order-level only —
// Order has no per-item notes field, and adding one is out of scope (see
// the plan's decision on not touching Order's schema).
export function buildKitchenOrderPayload(input: {
  order: KitchenOrderInput;
  table: ReceiptTableInput;
}): KitchenOrderPayload {
  return {
    orderNumber: input.order._id.toString().slice(-8).toUpperCase(),
    tableLabel: buildTableLabel(input.table),
    time: formatLocalTime(input.order.at),
    items: input.order.items.map((item) => ({
      productName: item.productName,
      variantSize: item.variantSize,
      quantity: item.quantity,
    })),
    notes: input.order.notes,
  };
}

export function buildTestPrintPayload(input: { printerName: string; ip: string; at: Date }): TestPrintPayload {
  return {
    printerName: input.printerName,
    ip: input.ip,
    date: formatLocalDate(input.at),
    time: formatLocalTime(input.at),
    sampleQrData: 'https://laislacafepicnic.com',
  };
}
