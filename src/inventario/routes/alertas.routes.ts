import { Router } from 'express';
import { getAlertas, marcarComprado } from '../controllers/alertasController';

const router = Router();
router.get('/', getAlertas);
router.post('/:insumoId/marcar-comprado', marcarComprado);
export default router;
