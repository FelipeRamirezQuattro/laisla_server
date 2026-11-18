import { Router } from 'express';
import { getSalesReport, getProductsReport, getRecipesWeeklyReport, getSalesTrendsReport } from '../../controllers/reportController';

const router = Router();

router.get('/sales', getSalesReport);
router.get('/products', getProductsReport);
router.get('/recipes-weekly', getRecipesWeeklyReport);
router.get('/sales-trends', getSalesTrendsReport);

export default router;
