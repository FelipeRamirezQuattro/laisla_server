import { Router } from 'express';
import { createPrinter, deletePrinter, getPrinters, testPrinter, updatePrinter } from '../controllers/printersController';
import {
  createPrintAgent,
  getPrintAgents,
  regeneratePrintAgentToken,
  revokePrintAgent,
} from '../controllers/printAgentsController';
import { getPrintConfig, updatePrintConfig } from '../controllers/printConfigController';
import { getPrintingAlerts, listPrintJobs, reprintOrder, retryPrintJobHandler } from '../controllers/printJobsController';

const router = Router();

router.get('/printers', getPrinters);
router.post('/printers', createPrinter);
router.put('/printers/:id', updatePrinter);
router.delete('/printers/:id', deletePrinter);
router.post('/printers/:id/test', testPrinter);

router.get('/agents', getPrintAgents);
router.post('/agents', createPrintAgent);
router.post('/agents/:id/revoke', revokePrintAgent);
router.post('/agents/:id/regenerate-token', regeneratePrintAgentToken);

router.get('/config', getPrintConfig);
router.put('/config', updatePrintConfig);

router.get('/jobs', listPrintJobs);
router.post('/jobs/:id/retry', retryPrintJobHandler);
router.post('/orders/:orderId/reprint', reprintOrder);

router.get('/alerts', getPrintingAlerts);

export default router;
