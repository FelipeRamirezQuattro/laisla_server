import { Router } from 'express';
import {
  adjust,
  approve,
  closeShift,
  getDeletionPreview,
  removeShift,
  updateShift,
  createMovement,
  getBalances,
  getById,
  getFiscalCheck,
  getOpen,
  getSummary,
  listAll,
  openNewShift,
  postTransfer,
} from '../controllers/cashShiftController';

const router = Router();

router.get('/open', getOpen);
router.get('/balances', getBalances);
router.post('/transfers', postTransfer);
router.get('/', listAll);
router.get('/:id', getById);
router.get('/:id/summary', getSummary);
router.get('/:id/fiscal-check', getFiscalCheck);
router.post('/', openNewShift);
router.post('/:id/movements', createMovement);
router.post('/:id/close', closeShift);
router.post('/:id/approve', approve);
router.post('/:id/adjust', adjust);
router.get('/:id/deletion-preview', getDeletionPreview);
router.put('/:id', updateShift);
router.delete('/:id', removeShift);

export default router;
