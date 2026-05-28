import { Router } from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
} from '../../controllers/productController';
import { productValidators, handleValidationErrors } from '../../middleware/validators';

const router = Router();

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', productValidators, handleValidationErrors, createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.patch('/:id/toggle', toggleProductStatus);

export default router;
