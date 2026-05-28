import { Router } from 'express';
import {
  getReservations,
  getReservation,
  createAdminReservation,
  updateReservationStatus,
  deleteReservation,
} from '../../controllers/reservationController';

const router = Router();

router.get('/', getReservations);
router.post('/', createAdminReservation);
router.get('/:id', getReservation);
router.patch('/:id/status', updateReservationStatus);
router.delete('/:id', deleteReservation);

export default router;
