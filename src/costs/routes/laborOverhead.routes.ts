import { Router } from 'express';
import { getParams, updateParams, cascadePreviewParams, getSuggestion } from '../controllers/laborOverheadController';

const router = Router();
router.get('/cascade-preview', cascadePreviewParams);
router.get('/suggestion', getSuggestion);
router.get('/', getParams);
router.put('/', updateParams);
export default router;
