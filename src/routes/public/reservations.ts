import { Router } from 'express';
import { createPublicReservation } from '../../controllers/reservationController';
import { reservationValidators, handleValidationErrors } from '../../middleware/validators';

const router = Router();

router.post('/', reservationValidators, handleValidationErrors, createPublicReservation);

export default router;
