import { Router } from 'express';
import { bookEventSpot } from '../../controllers/dinnerGuestController';

const router = Router();

router.post('/:id/book', bookEventSpot);

export default router;
