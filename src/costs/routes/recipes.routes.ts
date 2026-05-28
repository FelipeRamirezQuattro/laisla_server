import { Router } from 'express';
import {
  getRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe, getCostSheet,
  getRecipeCategories, createRecipeCategory, updateRecipeCategory, deleteRecipeCategory,
} from '../controllers/recipesController';

const router = Router();
router.get('/categories', getRecipeCategories);
router.post('/categories', createRecipeCategory);
router.put('/categories/:id', updateRecipeCategory);
router.delete('/categories/:id', deleteRecipeCategory);
router.get('/', getRecipes);
router.get('/:id/cost-sheet', getCostSheet);
router.get('/:id', getRecipe);
router.post('/', createRecipe);
router.put('/:id', updateRecipe);
router.delete('/:id', deleteRecipe);
export default router;
