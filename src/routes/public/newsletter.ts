import { Router } from 'express';
import { subscribeToNewsletter } from '../../controllers/newsletterController';
import { handleValidationErrors, newsletterSubscribeValidators } from '../../middleware/validators';

const router = Router();

router.post('/subscribe', newsletterSubscribeValidators, handleValidationErrors, subscribeToNewsletter);

export default router;
