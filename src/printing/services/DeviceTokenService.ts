import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const TOKEN_BYTES = 32;

// Returns a new device token in cleartext — callers must show it to the
// admin exactly once (agent creation/regeneration) and only ever persist
// the hash afterward.
export function generateDeviceToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

export async function hashDeviceToken(token: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(token, salt);
}

export async function verifyDeviceToken(token: string, tokenHash: string): Promise<boolean> {
  return bcrypt.compare(token, tokenHash);
}
