import { Router } from 'express';
import { createDailyExpense, deleteDailyExpense, getDailyExpenses, getLastInsumoPrices, updateDailyExpense } from '../../controllers/dailyExpenseController';

const router = Router();

router.get('/', getDailyExpenses);
router.get('/last-prices', getLastInsumoPrices);
router.post('/', createDailyExpense);
router.put('/:id', updateDailyExpense);
router.delete('/:id', deleteDailyExpense);

export default router;
