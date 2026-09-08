import Recipe, { IRecipe } from '../models/Recipe';
import Insumo from '../../inventario/models/Insumo';
import DisposablePack from '../models/DisposablePack';
import LaborAndOverheadParams from '../models/LaborAndOverheadParams';
import { calcIngredientCost, calcVariantCosts } from './CostCalculationService';
import { calcConvertedCost } from '../../utils/measurementUnits';

export interface RecipeCostParams {
  laborPerItem: number;
  overheadPerItem: number;
  ivaRate: number;
  laborCostPerMinute: number;
}

/** Current MOD/GIF parameters, shaped for `computeRecipeVariantCosts`. */
export async function getRecipeCostParams(): Promise<RecipeCostParams> {
  const params = await LaborAndOverheadParams.findOne();
  return {
    laborPerItem: params?.laborPerItem ?? 0,
    overheadPerItem: params?.overheadPerItem ?? 0,
    ivaRate: params?.ivaRate ?? 0.19,
    laborCostPerMinute: ((params?.hourlyWage ?? 0) * (params?.numberOfWorkers ?? 1)) / 60,
  };
}

/** Preparation time for a recipe's first variant, including sub-recipes
 * flagged with `includePreparationTime`. `visited` guards against cycles. */
export async function getRecipePreparationMinutes(
  recipe: IRecipe,
  visited: Set<string> = new Set()
): Promise<number> {
  const id = String(recipe._id);
  if (visited.has(id)) return recipe.preparationTimeMinutes ?? 0;
  visited.add(id);

  const firstVariant = recipe.variants[0];
  if (!firstVariant) return recipe.preparationTimeMinutes ?? 0;

  let total = recipe.preparationTimeMinutes ?? 0;
  for (const ing of firstVariant.ingredients) {
    if (ing.ingredientType !== 'recipe' || !ing.includePreparationTime) continue;
    const subRecipe = await Recipe.findById(ing.ingredientRefId);
    if (!subRecipe) continue;
    total += (ing.quantity || 1) * (await getRecipePreparationMinutes(subRecipe, new Set(visited)));
  }
  return total;
}

/**
 * Recomputes every variant's ingredient costs, disposable-pack cost, and
 * derived pricing fields, mutating `recipe.variants` in place. Does not
 * save the document or cascade to dependent recipes — that's the caller's
 * job (see `recipesController.createRecipe/updateRecipe` for a single-recipe
 * save, and `CascadeUpdateService.recalcRecipe` for the cascading version
 * that also records cost history and recurses into parent recipes).
 */
export async function computeRecipeVariantCosts(
  recipe: IRecipe,
  params: RecipeCostParams
): Promise<void> {
  for (const variant of recipe.variants) {
    const ingredientCosts: number[] = [];
    let totalPreparationTimeMinutes = recipe.preparationTimeMinutes ?? 0;

    for (const ing of variant.ingredients) {
      if (ing.ingredientType === 'raw') {
        const insumo = await Insumo.findById(ing.ingredientRefId);
        ing.cost = insumo
          ? calcConvertedCost({
              quantity: ing.quantity,
              unit: ing.unit,
              totalPrice: insumo.precioLista,
              pricedQuantity: insumo.cantidadPresentacion,
              pricedUnit: insumo.unidad,
            })
          : 0;
      } else {
        const subRecipe = await Recipe.findById(ing.ingredientRefId);
        const subCost = subRecipe?.variants[0]?.totalCost ?? 0;
        ing.cost = calcIngredientCost(ing.quantity, subCost);
        if (subRecipe && ing.includePreparationTime) {
          totalPreparationTimeMinutes += (ing.quantity || 1) * (await getRecipePreparationMinutes(subRecipe));
        }
      }
      ingredientCosts.push(ing.cost);
    }

    let disposablePackCost = 0;
    if (variant.disposablePackId) {
      const pack = await DisposablePack.findById(variant.disposablePackId);
      disposablePackCost = pack?.totalCost ?? 0;
    }

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
  }
}
