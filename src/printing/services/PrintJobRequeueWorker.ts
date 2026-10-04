import { env } from '../../config/env';
import { requeueStaleClaimedJobs } from './PrintJobService';

const POLL_INTERVAL_MS = 20_000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

export function startPrintJobRequeueWorker(): void {
  intervalHandle = setInterval(() => {
    if (isProcessing) return;
    isProcessing = true;
    requeueStaleClaimedJobs(env.PRINT_JOB_CLAIM_TIMEOUT_SECONDS, env.PRINT_JOB_MAX_ATTEMPTS)
      .catch((err) => console.error('Error reencolando trabajos de impresión atascados:', err))
      .finally(() => {
        isProcessing = false;
      });
  }, POLL_INTERVAL_MS);
}

export function stopPrintJobRequeueWorker(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}
