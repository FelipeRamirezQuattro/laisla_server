import { Router } from 'express';
import { claimPrintJob, heartbeat, reportPrintJobResult } from '../controllers/deviceController';

const router = Router();

router.post('/print-jobs/claim', claimPrintJob);
router.post('/print-jobs/:id/result', reportPrintJobResult);
router.post('/heartbeat', heartbeat);

export default router;
