import { Router } from 'express';
import {
  getRawMaterials, getRawMaterial, createRawMaterial,
  updateRawMaterial, deleteRawMaterial, cascadePreviewRawMaterial,
} from '../controllers/rawMaterialsController';

const router = Router();
router.get('/', getRawMaterials);
router.get('/:id/cascade-preview', cascadePreviewRawMaterial);
router.get('/:id', getRawMaterial);
router.post('/', createRawMaterial);
router.put('/:id', updateRawMaterial);
router.delete('/:id', deleteRawMaterial);
export default router;
