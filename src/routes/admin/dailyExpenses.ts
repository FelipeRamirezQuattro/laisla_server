import { Router } from 'express';
import { createDailyExpense, getDailyExpenses, updateDailyExpense } from '../../controllers/dailyExpenseController';

const router = Router();

router.get('/', getDailyExpenses);
router.post('/', createDailyExpense);
router.put('/:id', updateDailyExpense);

export default router;
