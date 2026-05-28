import { Router } from 'express';
import {
  getFrecuenciaAgotamiento, getCumplimiento, getInsumosCriticos, getHoraPromedio,
} from '../controllers/reportesController';

const router = Router();
router.get('/frecuencia-agotamiento', getFrecuenciaAgotamiento);
router.get('/cumplimiento', getCumplimiento);
router.get('/insumos-criticos', getInsumosCriticos);
router.get('/hora-promedio', getHoraPromedio);
export default router;
