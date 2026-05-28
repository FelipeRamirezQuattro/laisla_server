import { Router } from 'express';
import { bookEventSpot } from '../../controllers/dinnerGuestController';
import { eventBookingValidators, handleValidationErrors } from '../../middleware/validators';

const router = Router();

router.post('/:id/book', eventBookingValidators, handleValidationErrors, bookEventSpot);

export default router;
