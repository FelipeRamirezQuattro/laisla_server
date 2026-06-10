import { Router } from 'express';
import { disconnectGmail, getGmailStatus, startGmailAuth } from '../../controllers/gmailController';

const router = Router();

router.get('/status', getGmailStatus);
router.get('/auth', startGmailAuth);
router.delete('/disconnect', disconnectGmail);

export default router;
