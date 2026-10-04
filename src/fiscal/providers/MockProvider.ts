import { randomUUID } from 'crypto';
import type {
  ElectronicInvoicingProvider,
  FiscalEmissionRequest,
  FiscalEmissionResult,
  FiscalFilesResult,
  FiscalStatusResult,
} from './ElectronicInvoicingProvider';

const REJECT_SENTINEL = 'MOCK_REJECT';
const ERROR_SENTINEL = 'MOCK_ERROR';
const TIMEOUT_SENTINEL = 'MOCK_TIMEOUT';

export class MockProvider implements ElectronicInvoicingProvider {
  readonly name = 'MOCK';

  async emitPosDocument(request: FiscalEmissionRequest): Promise<FiscalEmissionResult> {
    return this.emit(request, 'cude');
  }

  async emitInvoice(request: FiscalEmissionRequest): Promise<FiscalEmissionResult> {
    return this.emit(request, 'cufe');
  }

  async emitCreditNote(request: FiscalEmissionRequest): Promise<FiscalEmissionResult> {
    return this.emit(request, 'cude');
  }

  async getStatus(providerDocumentId: string): Promise<FiscalStatusResult> {
    return {
      status: 'ACCEPTED',
      cude: `MOCK-${providerDocumentId}`,
      qrData: `MOCK-QR-${providerDocumentId}`,
      pdfUrl: `https://mock.local/fiscal/${providerDocumentId}.pdf`,
      xmlUrl: `https://mock.local/fiscal/${providerDocumentId}.xml`,
    };
  }

  async getDocumentFiles(providerDocumentId: string): Promise<FiscalFilesResult> {
    return {
      pdfUrl: `https://mock.local/fiscal/${providerDocumentId}.pdf`,
      xmlUrl: `https://mock.local/fiscal/${providerDocumentId}.xml`,
    };
  }

  private async emit(
    request: FiscalEmissionRequest,
    codeField: 'cude' | 'cufe'
  ): Promise<FiscalEmissionResult> {
    const sentinel = request.acquirer.docNumber;

    if (sentinel === TIMEOUT_SENTINEL) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error('Simulated provider timeout (mock)');
    }

    if (sentinel === REJECT_SENTINEL) {
      return { success: false, status: 'REJECTED', errorMessage: 'Simulated DIAN rejection (mock)' };
    }

    if (sentinel === ERROR_SENTINEL) {
      return { success: false, status: 'ERROR', errorMessage: 'Simulated provider error (mock)' };
    }

    const id = randomUUID();
    const providerDocumentId = `MOCK-DOC-${id}`;
    const code = `MOCK-${id}`;

    return {
      success: true,
      status: 'ACCEPTED',
      providerDocumentId,
      [codeField]: code,
      qrData: `MOCK-QR-${code}`,
      pdfUrl: `https://mock.local/fiscal/${providerDocumentId}.pdf`,
      xmlUrl: `https://mock.local/fiscal/${providerDocumentId}.xml`,
    };
  }
}
