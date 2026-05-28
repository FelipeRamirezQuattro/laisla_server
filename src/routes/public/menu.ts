import { Router } from 'express';
import Recipe from '../../costs/models/Recipe';
import RecipeCategory from '../../costs/models/RecipeCategory';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [recipes, categories] = await Promise.all([
      Recipe.find({
        active: true,
        isProduct: true,
        isSubRecipe: false,
      }).sort({ category: 1, name: 1 }).lean(),
      RecipeCategory.find().sort({ orden: 1, label: 1 }).lean(),
    ]);

    res.json({ recipes, categories });
  } catch {
    res.status(500).json({ error: 'Error al obtener menú público' });
  }
});

export default router;
