import { describe, expect, it } from 'vitest';
import { MockProvider } from './MockProvider';
import type { FiscalEmissionRequest } from './ElectronicInvoicingProvider';

function makeRequest(overrides: Partial<FiscalEmissionRequest> = {}): FiscalEmissionRequest {
  return {
    orderId: 'order-1',
    documentType: 'DEE_POS',
    environment: 'TEST',
    issuer: {
      personType: 'NATURAL',
      idType: 'CC',
      idNumber: '123',
      businessName: 'Oscar',
      tradeName: 'La Isla Café Picnic',
      fiscalResponsibilities: [],
      ivaResponsible: true,
      consumptionTaxResponsible: false,
      address: 'Cra 1',
      municipality: 'Ibagué',
      email: 'a@b.com',
    },
    acquirer: {
      personType: 'NATURAL',
      docType: 'CONSUMIDOR_FINAL',
      docNumber: '222222222222',
      name: 'Consumidor Final',
    },
    items: [],
    taxSummary: [],
    subtotal: 1000,
    total: 1000,
    paymentMethod: 'CASH',
    issueDate: '2026-09-29',
    issueTime: '21:05:30',
    idempotencyKey: 'order-1:DEE_POS',
    ...overrides,
  };
}

describe('MockProvider', () => {
  it('accepts a DEE POS emission by default with a MOCK-prefixed cude', async () => {
    const provider = new MockProvider();
    const result = await provider.emitPosDocument(makeRequest());
    expect(result.success).toBe(true);
    expect(result.status).toBe('ACCEPTED');
    expect(result.cude).toMatch(/^MOCK-/);
    expect(result.cufe).toBeUndefined();
  });

  it('accepts an invoice emission by default with a MOCK-prefixed cufe', async () => {
    const provider = new MockProvider();
    const result = await provider.emitInvoice(makeRequest({ documentType: 'INVOICE' }));
    expect(result.success).toBe(true);
    expect(result.cufe).toMatch(/^MOCK-/);
    expect(result.cude).toBeUndefined();
  });

  it('rejects when acquirer.docNumber is the MOCK_REJECT sentinel', async () => {
    const provider = new MockProvider();
    const request = makeRequest({ acquirer: { ...makeRequest().acquirer, docNumber: 'MOCK_REJECT' } });
    const result = await provider.emitPosDocument(request);
    expect(result.success).toBe(false);
    expect(result.status).toBe('REJECTED');
    expect(result.errorMessage).toBeTruthy();
  });

  it('returns an ERROR status when acquirer.docNumber is the MOCK_ERROR sentinel', async () => {
    const provider = new MockProvider();
    const request = makeRequest({ acquirer: { ...makeRequest().acquirer, docNumber: 'MOCK_ERROR' } });
    const result = await provider.emitPosDocument(request);
    expect(result.success).toBe(false);
    expect(result.status).toBe('ERROR');
  });

  it('throws (simulating a timeout) when acquirer.docNumber is the MOCK_TIMEOUT sentinel', async () => {
    const provider = new MockProvider();
    const request = makeRequest({ acquirer: { ...makeRequest().acquirer, docNumber: 'MOCK_TIMEOUT' } });
    await expect(provider.emitPosDocument(request)).rejects.toThrow();
  });

  it('returns a deterministic status keyed off the given providerDocumentId', async () => {
    const provider = new MockProvider();
    const result = await provider.getStatus('MOCK-DOC-abc');
    expect(result.status).toBe('ACCEPTED');
  });

  it('returns deterministic file urls keyed off the given providerDocumentId', async () => {
    const provider = new MockProvider();
    const result = await provider.getDocumentFiles('MOCK-DOC-abc');
    expect(result.pdfUrl).toContain('MOCK-DOC-abc');
    expect(result.xmlUrl).toContain('MOCK-DOC-abc');
  });
});
