import mongoose from 'mongoose';
import Insumo from '../../inventario/models/Insumo';
import DisposablePack from '../models/DisposablePack';
import Recipe, { IRecipe } from '../models/Recipe';
import LaborAndOverheadParams from '../models/LaborAndOverheadParams';
import CostHistory from '../models/CostHistory';
import { calcIngredientCost, calcVariantCosts } from './CostCalculationService';
import { calcConvertedCost } from '../../utils/measurementUnits';

async function getParams() {
  const params = await LaborAndOverheadParams.findOne();
  return {
    laborPerItem: params?.laborPerItem ?? 0,
    overheadPerItem: params?.overheadPerItem ?? 0,
    ivaRate: params?.ivaRate ?? 0.19,
    laborCostPerMinute: ((params?.hourlyWage ?? 0) * (params?.numberOfWorkers ?? 1)) / 60,
  };
}

async function getRecipePreparationMinutes(
  recipe: IRecipe,
  visited = new Set<string>()
): Promise<number> {
  const id = (recipe._id as mongoose.Types.ObjectId).toString();
  if (visited.has(id)) return recipe.preparationTimeMinutes ?? 0;
  visited.add(id);

  const firstVariant = recipe.variants[0];
  if (!firstVariant) return recipe.preparationTimeMinutes ?? 0;

  let total = recipe.preparationTimeMinutes ?? 0;
  for (const ing of firstVariant.ingredients) {
    if (ing.ingredientType !== 'recipe' || !ing.includePreparationTime) continue;
    const subRecipe = await Recipe.findById(ing.ingredientRefId);
    if (!subRecipe) continue;
    total += (ing.quantity || 1) * await getRecipePreparationMinutes(subRecipe, new Set(visited));
  }
  return total;
}

async function recalcRecipe(
  recipe: IRecipe,
  params: { laborPerItem: number; overheadPerItem: number; ivaRate: number; laborCostPerMinute: number },
  userId: string,
  visited: Set<string>
): Promise<void> {
  const id = (recipe._id as mongoose.Types.ObjectId).toString();
  if (visited.has(id)) return;
  visited.add(id);

  for (const variant of recipe.variants) {
    const ingredientCosts: number[] = [];
    let totalPreparationTimeMinutes = recipe.preparationTimeMinutes ?? 0;

    for (const ing of variant.ingredients) {
      if (ing.ingredientType === 'raw') {
        const raw = await Insumo.findById(ing.ingredientRefId);
        const cost = raw ? calcConvertedCost({
          quantity: ing.quantity,
          unit: ing.unit,
          totalPrice: raw.precioLista,
          pricedQuantity: raw.cantidadPresentacion,
          pricedUnit: raw.unidad,
        }) : 0;
        ing.cost = cost;
        ingredientCosts.push(cost);
      } else {
        const subRecipe = await Recipe.findById(ing.ingredientRefId);
        const subCost = subRecipe?.variants[0]?.totalCost ?? 0;
        const cost = calcIngredientCost(ing.quantity, subCost);
        ing.cost = cost;
        ingredientCosts.push(cost);
        if (subRecipe && ing.includePreparationTime) {
          totalPreparationTimeMinutes += (ing.quantity || 1) * await getRecipePreparationMinutes(subRecipe);
        }
      }
    }

    let disposablePackCost = 0;
    if (variant.disposablePackId) {
      const pack = await DisposablePack.findById(variant.disposablePackId);
      disposablePackCost = pack?.totalCost ?? 0;
    }

    const oldTotalCost = variant.totalCost;
    const result = calcVariantCosts({
      ingredientCosts,
      disposablePackCost,
      laborPerItem: params.laborPerItem,
      overheadPerItem: params.overheadPerItem,
      preparationTimeMinutes: totalPreparationTimeMinutes,
      laborCostPerMinute: params.laborCostPerMinute,
      salePrice: variant.salePrice,
      costingMethod: variant.costingMethod ?? 'food-cost',
      targetMargin: variant.targetMargin ?? undefined,
      targetFoodCostPct: variant.targetFoodCostPct ?? undefined,
      ivaRate: params.ivaRate,
      taxRate: variant.taxRate ?? params.ivaRate,
      taxIncluded: variant.taxIncluded ?? true,
    });

    variant.totalPreparationTimeMinutes = totalPreparationTimeMinutes;
    Object.assign(variant, result);

    if (oldTotalCost !== result.totalCost) {
      await CostHistory.create({
        entityType: 'RECIPE',
        entityId: recipe._id,
        field: `variants[${variant.size}].totalCost`,
        oldValue: oldTotalCost,
        newValue: result.totalCost,
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
  const params = await getParams();
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
  const params = await getParams();
  const recipe = await Recipe.findById(recipeId);
  if (!recipe) return;
  await recalcRecipe(recipe, params, userId, new Set());
}
