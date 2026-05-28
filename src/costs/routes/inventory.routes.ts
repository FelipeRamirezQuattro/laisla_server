import { Router } from 'express';
import {
  getCurrentInventory, getInventoryHistory, createMovement,
  getInventoryAlerts, getReorderReport,
} from '../controllers/inventoryController';

const router = Router();
router.get('/alerts', getInventoryAlerts);
router.get('/reorder-report', getReorderReport);
router.get('/', getCurrentInventory);
router.get('/:rawMaterialId/history', getInventoryHistory);
router.post('/movements', createMovement);
export default router;
