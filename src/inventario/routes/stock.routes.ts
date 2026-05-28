import { Router } from 'express';
import {
  approveMovement,
  createPurchase,
  getCurrentStock,
  getInsumoStockHistory,
  rejectMovement,
} from '../controllers/stockController';

const router = Router();

router.get('/', getCurrentStock);
router.get('/insumos/:insumoId/history', getInsumoStockHistory);
router.post('/insumos/:insumoId/purchases', createPurchase);
router.patch('/movements/:movementId/approve', approveMovement);
router.patch('/movements/:movementId/reject', rejectMovement);

export default router;
