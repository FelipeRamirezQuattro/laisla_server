import { Router } from 'express';
import {
  adjust,
  approve,
  closeShift,
  createMovement,
  getById,
  getFiscalCheck,
  getOpen,
  getSummary,
  listAll,
  openNewShift,
} from '../controllers/cashShiftController';

const router = Router();

router.get('/open', getOpen);
router.get('/', listAll);
router.get('/:id', getById);
router.get('/:id/summary', getSummary);
router.get('/:id/fiscal-check', getFiscalCheck);
router.post('/', openNewShift);
router.post('/:id/movements', createMovement);
router.post('/:id/close', closeShift);
router.post('/:id/approve', approve);
router.post('/:id/adjust', adjust);

export default router;
