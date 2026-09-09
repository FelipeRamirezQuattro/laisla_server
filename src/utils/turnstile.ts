import { env } from '../config/env';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile token server-side. If TURNSTILE_SECRET_KEY
 * isn't configured (e.g. local dev without a Cloudflare account set up yet),
 * verification is skipped so the form still works — this is meant to
 * degrade the same way the Gmail/EMAIL_LOG_ONLY config does elsewhere in
 * this codebase, not to silently disable protection in production once the
 * key is set.
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    if (remoteIp) params.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = (await res.json()) as { success: boolean };
    return !!data.success;
  } catch (error) {
    console.error('Error verifying Turnstile token:', error);
    return false;
  }
}
