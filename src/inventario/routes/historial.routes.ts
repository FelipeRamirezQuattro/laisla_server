import { Router } from 'express';
import { getHistorial, getRevisionDetalle } from '../controllers/historialController';

const router = Router();
router.get('/', getHistorial);
router.get('/:revisionId', getRevisionDetalle);
export default router;
