import { Router } from 'express';
import {
  getYearResults, createResult, updateResult, getMonthResult, getYearSummary,
} from '../controllers/actualResultsController';

const router = Router();
router.get('/:year/summary', getYearSummary);
router.get('/:year/:month', getMonthResult);
router.get('/:year', getYearResults);
router.post('/', createResult);
router.put('/:id', updateResult);
export default router;
