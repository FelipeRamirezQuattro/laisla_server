import { Router } from 'express';
import {
  createCreditNote,
  getConfig,
  getDocument,
  getDocumentFiles,
  getHealth,
  getOrderTicket,
  listDocuments,
  retryDocument,
  updateConfig,
} from '../controllers/fiscalController';

const router = Router();

router.get('/health', getHealth);
router.get('/config', getConfig);
router.put('/config', updateConfig);
router.get('/documents', listDocuments);
router.get('/documents/:id', getDocument);
router.post('/documents/:id/retry', retryDocument);
router.get('/documents/:id/files', getDocumentFiles);
router.post('/documents/:id/credit-note', createCreditNote);
router.get('/orders/:orderId/ticket', getOrderTicket);

export default router;
