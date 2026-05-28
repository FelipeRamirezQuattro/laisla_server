import { Router } from 'express';
import { getParams, updateParams, cascadePreviewParams } from '../controllers/laborOverheadController';

const router = Router();
router.get('/cascade-preview', cascadePreviewParams);
router.get('/', getParams);
router.put('/', updateParams);
export default router;
