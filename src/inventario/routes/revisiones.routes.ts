import { Router } from 'express';
import {
  createOrGetRevision, getHoy, getRevisionDetalles,
  updateDetalle, bulkUpdateDetalles, cerrarRevision, reabrirRevision,
} from '../controllers/revisionesController';

const router = Router();
router.get('/hoy', getHoy);
router.get('/:id', getRevisionDetalles);
router.post('/', createOrGetRevision);
router.patch('/:id/detalles/bulk', bulkUpdateDetalles);
router.patch('/:id/detalles/:insumoId', updateDetalle);
router.post('/:id/cerrar', cerrarRevision);
router.post('/:id/reabrir', reabrirRevision);
export default router;
