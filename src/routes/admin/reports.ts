import { Router } from 'express';
import { getSalesReport, getProductsReport, getRecipesWeeklyReport } from '../../controllers/reportController';

const router = Router();

router.get('/sales', getSalesReport);
router.get('/products', getProductsReport);
router.get('/recipes-weekly', getRecipesWeeklyReport);

export default router;
