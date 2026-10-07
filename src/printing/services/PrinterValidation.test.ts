import { describe, expect, it } from 'vitest';
import { validatePrinterConnection } from './PrinterValidation';

describe('validatePrinterConnection', () => {
  it('passes for a NETWORK printer with an ip', () => {
    expect(validatePrinterConnection({ connectionType: 'NETWORK', ip: '192.168.1.50' })).toBeNull();
  });

  it('defaults a missing connectionType to NETWORK and still requires an ip', () => {
    expect(validatePrinterConnection({})).toMatch(/IP/);
  });

  it('rejects a NETWORK printer with no ip', () => {
    expect(validatePrinterConnection({ connectionType: 'NETWORK' })).toMatch(/IP/);
  });

  it('rejects a NETWORK printer with a blank ip', () => {
    expect(validatePrinterConnection({ connectionType: 'NETWORK', ip: '   ' })).toMatch(/IP/);
  });

  it('passes for a USB printer with a localPath', () => {
    expect(validatePrinterConnection({ connectionType: 'USB', localPath: '\\\\.\\COM3' })).toBeNull();
  });

  it('rejects a USB printer with no localPath', () => {
    expect(validatePrinterConnection({ connectionType: 'USB' })).toMatch(/puerto|localPath|COM/i);
  });

  it('rejects a USB printer with a blank localPath', () => {
    expect(validatePrinterConnection({ connectionType: 'USB', localPath: '  ' })).toMatch(/puerto|localPath|COM/i);
  });
});
