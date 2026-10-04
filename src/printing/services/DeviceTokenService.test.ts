import { describe, expect, it } from 'vitest';
import { generateDeviceToken, hashDeviceToken, verifyDeviceToken } from './DeviceTokenService';

describe('DeviceTokenService', () => {
  it('generates a random hex token that differs on every call', () => {
    const a = generateDeviceToken();
    const b = generateDeviceToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never stores the cleartext token as its own hash', async () => {
    const token = generateDeviceToken();
    const hash = await hashDeviceToken(token);
    expect(hash).not.toEqual(token);
  });

  it('verifies a token against its own hash', async () => {
    const token = generateDeviceToken();
    const hash = await hashDeviceToken(token);
    await expect(verifyDeviceToken(token, hash)).resolves.toBe(true);
  });

  it('rejects a token that does not match the hash', async () => {
    const hash = await hashDeviceToken(generateDeviceToken());
    await expect(verifyDeviceToken(generateDeviceToken(), hash)).resolves.toBe(false);
  });
});
