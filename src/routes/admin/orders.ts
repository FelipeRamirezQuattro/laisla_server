import { Router } from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  closeOrder,
  cancelOrder,
  deliverOrder,
  getOrderTimingStats,
} from '../../controllers/orderController';
import { orderValidators, handleValidationErrors } from '../../middleware/validators';

const router = Router();

router.get('/', getOrders);
router.get('/stats/timing', getOrderTimingStats);
router.get('/:id', getOrder);
router.post('/', orderValidators, handleValidationErrors, createOrder);
router.put('/:id', updateOrder);
router.patch('/:id/deliver', deliverOrder);
router.patch('/:id/close', closeOrder);
router.patch('/:id/cancel', cancelOrder);

export default router;
