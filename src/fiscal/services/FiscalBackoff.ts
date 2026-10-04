// Exponential backoff for retrying a failed fiscal emission: 1min, 2min,
// 4min, ... capped at 30min. After MAX_FISCAL_ATTEMPTS failures the document
// moves to CONTINGENCY instead of scheduling another retry.
const BASE_DELAY_MS = 60_000;
const MAX_DELAY_MS = 30 * 60_000;

export const MAX_FISCAL_ATTEMPTS = 5;

export function calculateNextAttemptDelayMs(attempts: number): number {
  const delay = BASE_DELAY_MS * 2 ** (attempts - 1);
  return Math.min(delay, MAX_DELAY_MS);
}

export function calculateNextAttemptAt(attempts: number, now: Date): Date {
  return new Date(now.getTime() + calculateNextAttemptDelayMs(attempts));
}
