import FiscalDocument from '../models/FiscalDocument';
import type { IFiscalDocument } from '../models/FiscalDocument';
import type { IFiscalConfig } from '../models/FiscalConfig';
import { buildFiscalPayload } from './FiscalPayloadMapper';
import type { MapperCustomer, MapperOrder, MapperOrderItem } from './FiscalPayloadMapper';

interface ClientFiscalLike {
  docType?: string;
  docNumber?: string;
  dv?: string;
  businessName?: string;
  personType?: 'NATURAL' | 'JURIDICA';
  fiscalEmail?: string;
}

interface ClientLike {
  name?: string;
  email?: string;
  fiscal?: ClientFiscalLike;
}

interface OrderItemLike {
  productName: string;
  quantity: number;
  unitPrice: number;
  taxType?: MapperOrderItem['taxType'];
  taxRate?: number;
  taxAmount?: number;
}

interface OrderLike {
  _id: { toString(): string };
  subtotal: number;
  total: number;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'nequi';
  items: OrderItemLike[];
}

// Pure: no client (walk-in with no fiscal data) maps to null, and the
// mapper's buildAcquirer treats that as "consumidor final".
export function clientToMapperCustomer(client: ClientLike | null): MapperCustomer | null {
  if (!client) return null;
  return {
    personType: client.fiscal?.personType ?? 'NATURAL',
    fiscal: client.fiscal
      ? {
          docType: client.fiscal.docType,
          docNumber: client.fiscal.docNumber,
          dv: client.fiscal.dv,
          businessName: client.fiscal.businessName,
          fiscalEmail: client.fiscal.fiscalEmail,
        }
      : undefined,
    name: client.name,
    email: client.email,
  };
}

// Pure: adapts an order-like document (real Mongoose Order or a test
// fixture) into the mapper's plain input shape.
export function orderToMapperOrder(order: OrderLike): MapperOrder {
  return {
    _id: order._id.toString(),
    subtotal: order.subtotal,
    total: order.total,
    paymentMethod: order.paymentMethod ?? 'cash',
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxType: item.taxType ?? 'NONE',
      taxRate: item.taxRate ?? 0,
      taxAmount: item.taxAmount ?? 0,
    })),
  };
}

// Not unit-tested: Mongoose-heavy orchestration, mirroring the rest of this
// backend's convention (e.g. InventoryDeductionService). Creates the
// FiscalDocument in PENDING status only — it never calls the provider, so
// it's safe to await from closeOrder without risking a slow/blocked close.
// Idempotent: a duplicate call (or a race) returns the existing document
// instead of creating a second one, backed by the unique partial index on
// FiscalDocument.orderId for DEE_POS/INVOICE.
export async function createPendingFiscalDocument(
  order: OrderLike & { _id: any },
  config: IFiscalConfig,
  client: ClientLike | null
): Promise<IFiscalDocument> {
  const existing = await FiscalDocument.findOne({
    orderId: order._id,
    type: { $in: ['DEE_POS', 'INVOICE'] },
  });
  if (existing) return existing;

  const payload = buildFiscalPayload({
    order: orderToMapperOrder(order),
    config: { environment: config.environment, issuer: config.issuer },
    customer: clientToMapperCustomer(client),
  });

  try {
    return await FiscalDocument.create({
      orderId: order._id,
      type: payload.documentType,
      issuerSnapshot: payload.issuer,
      acquirerSnapshot: payload.acquirer,
      totalsSnapshot: {
        subtotal: payload.subtotal,
        taxSummary: payload.taxSummary,
        total: payload.total,
      },
      status: 'PENDING',
      attempts: 0,
      idempotencyKey: payload.idempotencyKey,
    });
  } catch (err: any) {
    // Duplicate key race (two concurrent close attempts for the same order).
    if (err?.code === 11000) {
      const raceWinner = await FiscalDocument.findOne({
        orderId: order._id,
        type: { $in: ['DEE_POS', 'INVOICE'] },
      });
      if (raceWinner) return raceWinner;
    }
    throw err;
  }
}
