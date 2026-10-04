import { Request, Response } from 'express';
import FiscalDocument from '../models/FiscalDocument';
import Order from '../../models/Order';
import { getProvider } from '../providers/getProvider';
import type { FiscalProviderName } from '../models/FiscalConfig';
import { createReceiptJobForFiscalDocument } from '../../printing/services/PrintJobService';

// Skeleton only — completed once we have the real provider's webhook docs.
// TODO(provider-docs): verify the request signature/secret before trusting
// the payload (header name, HMAC scheme, etc. are provider-specific and
// unknown until we have their docs). Until then this endpoint trusts
// nothing it can't already recompute, and only ever acks with 200 so an
// unverifiable/unexpected payload can't make the provider retry-storm us.
export async function receiveFiscalWebhook(req: Request, res: Response): Promise<void> {
  try {
    const providerName = req.params.provider?.toUpperCase() as FiscalProviderName;

    let provider;
    try {
      provider = getProvider({ provider: providerName });
    } catch {
      // Unknown or not-yet-implemented provider (Fase 3) — nothing to do.
      res.status(200).json({ received: true });
      return;
    }

    if (!provider.parseWebhook) {
      res.status(200).json({ received: true });
      return;
    }

    const event = provider.parseWebhook(req.body);
    if (!event?.providerDocumentId) {
      res.status(200).json({ received: true });
      return;
    }

    const document = await FiscalDocument.findOne({ providerDocumentId: event.providerDocumentId });
    if (document) {
      document.status = event.status;
      await document.save();

      // Ticket de caja: best-effort, nunca debe afectar el ack al proveedor.
      if (document.status === 'ACCEPTED' || document.status === 'CONTINGENCY') {
        try {
          const order = await Order.findById(document.orderId);
          if (order) await createReceiptJobForFiscalDocument(document, order);
        } catch (err) {
          console.error(`Error creando el trabajo de impresión del ticket para la orden ${document.orderId}:`, err);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing fiscal webhook:', err);
    // Still ack — an internal error here shouldn't cause the provider to
    // retry-storm this endpoint.
    res.status(200).json({ received: true });
  }
}
