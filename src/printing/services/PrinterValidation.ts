// Pure: a NETWORK printer needs an ip to build tcp://ip:port; a USB printer
// needs a localPath (the OS-assigned port/device path, e.g. \\.\COM3 on
// Windows) instead — see print-agent/src/printer.ts buildPrinterInterface,
// which this mirrors on the server side so bad data never reaches a printer
// doc in the first place. Returns an error message, or null when valid.
export function validatePrinterConnection(input: {
  connectionType?: 'NETWORK' | 'USB';
  ip?: string;
  localPath?: string;
}): string | null {
  const connectionType = input.connectionType ?? 'NETWORK';

  if (connectionType === 'USB') {
    if (!input.localPath?.trim()) {
      return 'El puerto o ruta local (localPath) es requerido para una impresora USB, ej. \\\\.\\COM3';
    }
    return null;
  }

  if (!input.ip?.trim()) {
    return 'La IP es requerida para una impresora de red';
  }
  return null;
}
