import { Router } from 'express';
import { gmailCallback } from '../../controllers/gmailController';

const router = Router();

router.get('/callback', gmailCallback);

export default router;
