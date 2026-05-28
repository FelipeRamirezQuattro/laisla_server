import { Router } from 'express';
import { registerDinnerGuest } from '../../controllers/dinnerGuestController';
import { dinnerGuestValidators, handleValidationErrors } from '../../middleware/validators';

const router = Router();

router.post('/', dinnerGuestValidators, handleValidationErrors, registerDinnerGuest);

export default router;
