import { Router } from 'express';
import { getDashboardSummary, getMonthlySales } from '../../controllers/dashboardController';

const router = Router();

router.get('/summary', getDashboardSummary);
router.get('/monthly-sales', getMonthlySales);

export default router;
