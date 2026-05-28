import { Router } from 'express';
import {
  getInsumosAgrupados, getInsumosCatalog, getCategorias,
  createCategoria, createInsumo, deleteCategoria, updateCategoria,
  updateInsumo, bulkUpdateInsumos, deleteInsumo, reactivarInsumo, importCsv,
} from '../controllers/insumosController';

const router = Router();
router.get('/categorias', getCategorias);
router.post('/categorias', createCategoria);
router.put('/categorias/:id', updateCategoria);
router.delete('/categorias/:id', deleteCategoria);
router.get('/catalog', getInsumosCatalog);
router.get('/', getInsumosAgrupados);
router.post('/import-csv', importCsv);
router.patch('/bulk', bulkUpdateInsumos);
router.post('/', createInsumo);
router.put('/:id', updateInsumo);
router.patch('/:id/reactivar', reactivarInsumo);
router.delete('/:id', deleteInsumo);
export default router;
