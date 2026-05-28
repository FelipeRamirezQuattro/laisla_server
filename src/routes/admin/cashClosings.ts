import { Router } from 'express';
import { getCashClosings, createCashClosing, getDailySales } from '../../controllers/cashClosingController';

const router = Router();

router.get('/', getCashClosings);
router.get('/daily-sales', getDailySales);
router.post('/', createCashClosing);

export default router;
