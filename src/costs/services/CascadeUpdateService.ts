import mongoose from 'mongoose';
import Recipe, { IRecipe } from '../models/Recipe';
import CostHistory from '../models/CostHistory';
import {
  computeRecipeVariantCosts,
  getRecipeCostParams,
  type RecipeCostParams,
} from './RecipeCostOrchestrator';

async function recalcRecipe(
  recipe: IRecipe,
  params: RecipeCostParams,
  userId: string,
  visited: Set<string>
): Promise<void> {
  const id = (recipe._id as mongoose.Types.ObjectId).toString();
  if (visited.has(id)) return;
  visited.add(id);

  const oldCosts = recipe.variants.map((v) => v.totalCost);
  await computeRecipeVariantCosts(recipe, params);

  for (let i = 0; i < recipe.variants.length; i++) {
    const variant = recipe.variants[i];
    if (oldCosts[i] !== variant.totalCost) {
      await CostHistory.create({
        entityType: 'RECIPE',
        entityId: recipe._id,
        field: `variants[${variant.size}].totalCost`,
        oldValue: oldCosts[i],
        newValue: variant.totalCost,
        changedBy: new mongoose.Types.ObjectId(userId),
        changedAt: new Date(),
      });
    }
  }

  await recipe.save();

  // propagate to parent recipes that use this sub-recipe
  const parents = await Recipe.find({
    'variants.ingredients': {
      $elemMatch: {
        ingredientRefId: recipe._id,
        ingredientType: 'recipe',
      },
    },
    active: true,
  });

  for (const parent of parents) {
    await recalcRecipe(parent, params, userId, visited);
  }
}

export async function onParamsUpdated(userId: string): Promise<{ affectedRecipes: number }> {
  const params = await getRecipeCostParams();
  const visited = new Set<string>();

  const recipes = await Recipe.find({ active: true });
  for (const recipe of recipes) {
    await recalcRecipe(recipe, params, userId, visited);
  }

  return { affectedRecipes: visited.size };
}

export async function previewParamsCascade(): Promise<{ affectedRecipes: number }> {
  const count = await Recipe.countDocuments({ active: true });
  return { affectedRecipes: count };
}

export async function recalcRecipeById(
  recipeId: string,
  userId: string
): Promise<void> {
  const params = await getRecipeCostParams();
  const recipe = await Recipe.findById(recipeId);
  if (!recipe) return;
  await recalcRecipe(recipe, params, userId, new Set());
}
