import { Router } from 'express';
import { receiveFiscalWebhook } from '../controllers/fiscalWebhookController';

const router = Router();

router.post('/:provider', receiveFiscalWebhook);

export default router;
