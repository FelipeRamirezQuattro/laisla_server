import { Router } from 'express';
import { getProjection, createProjection, updateProjectionMonth, getComparison } from '../controllers/projectionsController';

const router = Router();
router.get('/:year/comparison', getComparison);
router.get('/:year', getProjection);
router.post('/', createProjection);
router.put('/:year/month/:month', updateProjectionMonth);
export default router;
