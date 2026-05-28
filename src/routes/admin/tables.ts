import { Router } from 'express';
import {
  getTables,
  getTable,
  getTableZones,
  createTableZone,
  updateTableZone,
  createTable,
  updateTable,
  deleteTable,
  releaseTable,
  releaseAllTables,
} from '../../controllers/tableController';
import { tableValidators, handleValidationErrors } from '../../middleware/validators';

const router = Router();

router.get('/zones', getTableZones);
router.post('/zones', createTableZone);
router.put('/zones/:id', updateTableZone);
router.get('/', getTables);
router.patch('/release-all', releaseAllTables);
router.get('/:id', getTable);
router.post('/', tableValidators, handleValidationErrors, createTable);
router.put('/:id', updateTable);
router.delete('/:id', deleteTable);
router.patch('/:id/release', releaseTable);

export default router;
