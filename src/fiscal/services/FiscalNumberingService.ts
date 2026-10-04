import type { FiscalDocumentTypeCode, IFiscalConfig, INumberingResolution } from '../models/FiscalConfig';

export interface AssignedNumber {
  prefix: string;
  number: number;
}

// Pure: picks the first resolution matching documentType that still has
// range left, without mutating anything. CREDIT_NOTE is intentionally
// unnumbered in Fase 2 unless a dedicated resolution is configured for it
// (no numbering-resolution precedent exists yet for credit notes).
export function pickNextNumber(
  numbering: INumberingResolution[],
  documentType: FiscalDocumentTypeCode
): AssignedNumber | null {
  for (const resolution of numbering) {
    if (resolution.documentType !== documentType) continue;
    const nextNumber = resolution.currentNumber + 1;
    if (nextNumber > resolution.rangeTo) continue;
    return { prefix: resolution.prefix, number: nextNumber };
  }
  return null;
}

// Not unit-tested: thin Mongoose persistence wrapper around pickNextNumber.
// A single worker instance processes one document at a time (no concurrent
// pollers), so a plain findOne/mutate/save is sufficient here, consistent
// with the rest of this backend (no transactions/optimistic locking used
// elsewhere either).
export async function reserveNextNumber(
  config: IFiscalConfig,
  documentType: FiscalDocumentTypeCode
): Promise<AssignedNumber | null> {
  const resolution = config.numbering.find(
    (item) => item.documentType === documentType && item.currentNumber + 1 <= item.rangeTo
  );
  if (!resolution) return null;

  resolution.currentNumber += 1;
  await config.save();

  return { prefix: resolution.prefix, number: resolution.currentNumber };
}
