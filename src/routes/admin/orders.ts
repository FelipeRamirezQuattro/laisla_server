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
  deleteOrders,
} from '../../controllers/orderController';
import { assignOrderShift, updateOrderPayments } from '../../caja/controllers/cashShiftController';
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
router.patch('/:id/shift', assignOrderShift);
router.patch('/:id/payments', updateOrderPayments);
router.post('/bulk-delete', deleteOrders);
router.delete('/:id', deleteOrders);

export default router;
