import mongoose from 'mongoose';
import RawMaterial from '../models/RawMaterial';
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
      targetMargin: variant.targetMargin ?? undefined,
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

export async function onRawMaterialUpdated(
  rawMaterialId: string,
  userId: string
): Promise<{ affectedPacks: number; affectedRecipes: number }> {
  const params = await getParams();
  const rawId = new mongoose.Types.ObjectId(rawMaterialId);
  const visited = new Set<string>();

  // Recalc packs that contain this raw material
  const packs = await DisposablePack.find({ 'items.rawMaterialId': rawId });
  for (const pack of packs) {
    for (const item of pack.items) {
      const raw = await RawMaterial.findById(item.rawMaterialId);
      item.cost = raw ? calcIngredientCost(item.quantity, raw.pricePerUnit) : 0;
    }
    const oldCost = pack.totalCost;
    pack.totalCost = pack.items.reduce((s, i) => s + i.cost, 0);
    if (oldCost !== pack.totalCost) {
      await CostHistory.create({
        entityType: 'DISPOSABLE_PACK',
        entityId: pack._id,
        field: 'totalCost',
        oldValue: oldCost,
        newValue: pack.totalCost,
        changedBy: new mongoose.Types.ObjectId(userId),
        changedAt: new Date(),
      });
    }
    await pack.save();
  }

  // Recalc recipes that use this raw material directly
  const directRecipes = await Recipe.find({
    'variants.ingredients': {
      $elemMatch: { ingredientRefId: rawId, ingredientType: 'raw' },
    },
    active: true,
  });

  for (const recipe of directRecipes) {
    await recalcRecipe(recipe, params, userId, visited);
  }

  // Recalc recipes that use updated packs
  const packIds = packs.map((p) => p._id);
  if (packIds.length > 0) {
    const packRecipes = await Recipe.find({
      'variants.disposablePackId': { $in: packIds },
      active: true,
    });
    for (const recipe of packRecipes) {
      await recalcRecipe(recipe, params, userId, visited);
    }
  }

  return { affectedPacks: packs.length, affectedRecipes: visited.size };
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

export async function previewRawMaterialCascade(
  rawMaterialId: string
): Promise<{ affectedPacks: number; affectedRecipes: number }> {
  const rawId = new mongoose.Types.ObjectId(rawMaterialId);
  const packs = await DisposablePack.find({ 'items.rawMaterialId': rawId });
  const packIds = packs.map((p) => p._id);

  const directRecipes = await Recipe.countDocuments({
    'variants.ingredients': {
      $elemMatch: { ingredientRefId: rawId, ingredientType: 'raw' },
    },
    active: true,
  });

  const packRecipes =
    packIds.length > 0
      ? await Recipe.countDocuments({
          'variants.disposablePackId': { $in: packIds },
          active: true,
        })
      : 0;

  return {
    affectedPacks: packs.length,
    affectedRecipes: directRecipes + packRecipes,
  };
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
