import { Router } from 'express';
import { getDisposablePacks, createDisposablePack, updateDisposablePack } from '../controllers/disposablePacksController';

const router = Router();
router.get('/', getDisposablePacks);
router.post('/', createDisposablePack);
router.put('/:id', updateDisposablePack);
export default router;
