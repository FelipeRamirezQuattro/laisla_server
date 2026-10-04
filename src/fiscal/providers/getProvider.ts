import { env } from '../../config/env';
import type { FiscalProviderName } from '../models/FiscalConfig';
import type { ElectronicInvoicingProvider } from './ElectronicInvoicingProvider';
import { MockProvider } from './MockProvider';

export type { FiscalProviderName };

export function getProvider(config?: { provider?: FiscalProviderName }): ElectronicInvoicingProvider {
  const selected: FiscalProviderName =
    config?.provider || (env.EINVOICE_PROVIDER as FiscalProviderName) || 'MOCK';

  switch (selected) {
    case 'MOCK':
      return new MockProvider();
    case 'ALANUBE':
      throw new Error('TODO(provider-docs): Alanube provider not implemented yet (Fase 3)');
    case 'BILIDOX':
      throw new Error('TODO(provider-docs): Bilidox/Grafosoft provider not implemented yet (Fase 3)');
    default:
      throw new Error(`Unknown fiscal provider: ${selected}`);
  }
}
