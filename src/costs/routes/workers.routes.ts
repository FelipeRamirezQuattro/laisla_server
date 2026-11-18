import { Router } from 'express';
import { createWorker, deactivateWorker, listWorkers, updateWorker } from '../controllers/workersController';

const router = Router();
router.get('/', listWorkers);
router.post('/', createWorker);
router.put('/:id', updateWorker);
router.delete('/:id', deactivateWorker);
export default router;
