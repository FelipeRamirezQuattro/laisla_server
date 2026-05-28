import { Router } from 'express';
import { getSalesReport, getProductsReport } from '../../controllers/reportController';

const router = Router();

router.get('/sales', getSalesReport);
router.get('/products', getProductsReport);

export default router;
