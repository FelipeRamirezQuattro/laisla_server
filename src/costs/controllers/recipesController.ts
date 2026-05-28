import { Response } from 'express';
import { AuthRequest } from '../../types';
import Recipe from '../models/Recipe';
import RecipeCategory, { DEFAULT_RECIPE_CATEGORIES } from '../models/RecipeCategory';
import Insumo from '../../inventario/models/Insumo';
import DisposablePack from '../models/DisposablePack';
import LaborAndOverheadParams from '../models/LaborAndOverheadParams';
import { calcIngredientCost, calcVariantCosts } from '../services/CostCalculationService';
import { calcConvertedCost } from '../../utils/measurementUnits';

const normalizeCategoryValue = (label: string) =>
  label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

async function ensureDefaultRecipeCategories(): Promise<void> {
  const count = await RecipeCategory.countDocuments();
  if (count > 0) return;
  await RecipeCategory.insertMany(
    DEFAULT_RECIPE_CATEGORIES.map((cat, idx) => ({ ...cat, orden: idx + 1 })),
    { ordered: false }
  );
}

async function computeVariantCosts(recipe: InstanceType<typeof Recipe>): Promise<void> {
  const params = await LaborAndOverheadParams.findOne();
  const laborPerItem = params?.laborPerItem ?? 0;
  const overheadPerItem = params?.overheadPerItem ?? 0;
  const ivaRate = params?.ivaRate ?? 0.19;
  const laborCostPerMinute = ((params?.hourlyWage ?? 0) * (params?.numberOfWorkers ?? 1)) / 60;

  const getRecipePreparationMinutes = async (
    target: InstanceType<typeof Recipe>,
    visited = new Set<string>()
  ): Promise<number> => {
    const targetId = String(target._id);
    if (visited.has(targetId)) return target.preparationTimeMinutes ?? 0;
    visited.add(targetId);

    const firstVariant = target.variants[0];
    if (!firstVariant) return target.preparationTimeMinutes ?? 0;

    let total = target.preparationTimeMinutes ?? 0;
    for (const ing of firstVariant.ingredients) {
      if (ing.ingredientType !== 'recipe' || !ing.includePreparationTime) continue;
      const subRecipe = await Recipe.findById(ing.ingredientRefId);
      if (!subRecipe) continue;
      total += (ing.quantity || 1) * await getRecipePreparationMinutes(subRecipe, new Set(visited));
    }
    return total;
  };

  for (const variant of recipe.variants) {
    const ingredientCosts: number[] = [];
    let totalPreparationTimeMinutes = recipe.preparationTimeMinutes ?? 0;

    for (const ing of variant.ingredients) {
      if (ing.ingredientType === 'raw') {
        const insumo = await Insumo.findById(ing.ingredientRefId);
        ing.cost = insumo ? calcConvertedCost({
          quantity: ing.quantity,
          unit: ing.unit,
          totalPrice: insumo.precioLista,
          pricedQuantity: insumo.cantidadPresentacion,
          pricedUnit: insumo.unidad,
        }) : 0;
      } else {
        const subRecipe = await Recipe.findById(ing.ingredientRefId);
        const subCost = subRecipe?.variants[0]?.totalCost ?? 0;
        ing.cost = calcIngredientCost(ing.quantity, subCost);
        if (subRecipe && ing.includePreparationTime) {
          totalPreparationTimeMinutes += (ing.quantity || 1) * await getRecipePreparationMinutes(subRecipe);
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
      laborPerItem,
      overheadPerItem,
      preparationTimeMinutes: totalPreparationTimeMinutes,
      laborCostPerMinute,
      salePrice: variant.salePrice,
      targetMargin: variant.targetMargin ?? undefined,
      ivaRate,
      taxRate: variant.taxRate ?? ivaRate,
      taxIncluded: variant.taxIncluded ?? true,
    });
    variant.totalPreparationTimeMinutes = totalPreparationTimeMinutes;
    Object.assign(variant, result);
  }
}

function normalizeRecipePayload(body: Record<string, any>): Record<string, any> {
  if (!Array.isArray(body.variants)) return body;
  return {
    ...body,
    variants: body.variants.map((variant: Record<string, any>) => ({
      ...variant,
      disposablePackId: variant.disposablePackId || null,
    })),
  };
}

export async function getRecipes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { category, active, isSubRecipe, isProduct, search } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (active !== undefined) filter.active = active === 'true';
    if (isSubRecipe !== undefined) filter.isSubRecipe = isSubRecipe === 'true';
    if (isProduct !== undefined) filter.isProduct = isProduct === 'true';
    if (search) filter.name = { $regex: search, $options: 'i' };
    const recipes = await Recipe.find(filter).sort({ category: 1, name: 1 });
    res.json(recipes);
  } catch {
    res.status(500).json({ error: 'Error al obtener recetas' });
  }
}

export async function getRecipeCategories(req: AuthRequest, res: Response): Promise<void> {
  try {
    await ensureDefaultRecipeCategories();
    const categories = await RecipeCategory.find().sort({ orden: 1, label: 1 });
    res.json(categories);
  } catch {
    res.status(500).json({ error: 'Error al obtener categorías de recetas' });
  }
}

export async function createRecipeCategory(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }

    const label = String(req.body.label ?? '').trim();
    if (!label) { res.status(400).json({ error: 'El nombre es requerido' }); return; }

    const value = normalizeCategoryValue(String(req.body.value ?? label));
    if (!value) { res.status(400).json({ error: 'Categoría inválida' }); return; }

    const exists = await RecipeCategory.findOne({ $or: [{ value }, { label: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }] });
    if (exists) { res.status(409).json({ error: 'La categoría ya existe' }); return; }

    const max = await RecipeCategory.findOne().sort({ orden: -1 }).select('orden').lean();
    const category = await RecipeCategory.create({ value, label, orden: (max?.orden ?? 0) + 1 });
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear categoría de receta', details: String(err) });
  }
}

export async function updateRecipeCategory(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }

    const label = String(req.body.label ?? '').trim();
    if (!label) { res.status(400).json({ error: 'El nombre es requerido' }); return; }

    const category = await RecipeCategory.findByIdAndUpdate(req.params.id, { label }, { new: true });
    if (!category) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar categoría de receta', details: String(err) });
  }
}

export async function deleteRecipeCategory(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Solo admin' }); return; }

    const category = await RecipeCategory.findById(req.params.id);
    if (!category) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }

    const count = await Recipe.countDocuments({ category: category.value });
    if (count > 0) {
      res.status(409).json({ error: 'No se puede eliminar una categoría con recetas', count });
      return;
    }

    await RecipeCategory.findByIdAndDelete(req.params.id);
    res.json({ message: 'Categoría eliminada' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar categoría de receta' });
  }
}

export async function getRecipe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) { res.status(404).json({ error: 'Receta no encontrada' }); return; }
    res.json(recipe);
  } catch {
    res.status(500).json({ error: 'Error al obtener receta' });
  }
}

export async function createRecipe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const recipe = new Recipe(normalizeRecipePayload(req.body));
    await computeVariantCosts(recipe);
    await recipe.save();
    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear receta', details: String(err) });
  }
}

export async function updateRecipe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) { res.status(404).json({ error: 'Receta no encontrada' }); return; }
    Object.assign(recipe, normalizeRecipePayload(req.body));
    await computeVariantCosts(recipe);
    await recipe.save();
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar receta', details: String(err) });
  }
}

export async function deleteRecipe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!recipe) { res.status(404).json({ error: 'Receta no encontrada' }); return; }
    res.json({ message: 'Receta desactivada', recipe });
  } catch {
    res.status(500).json({ error: 'Error al eliminar receta' });
  }
}

export async function getCostSheet(req: AuthRequest, res: Response): Promise<void> {
  try {
    const recipe = await Recipe.findById(req.params.id).lean();
    if (!recipe) { res.status(404).json({ error: 'Receta no encontrada' }); return; }

    const params = await LaborAndOverheadParams.findOne().lean();

    const enrichedVariants = await Promise.all(
      recipe.variants.map(async (variant) => {
        const enrichedIngredients = await Promise.all(
          variant.ingredients.map(async (ing) => {
            if (ing.ingredientType === 'raw') {
              const insumo = await Insumo.findById(ing.ingredientRefId).lean();
              return { ...ing, name: insumo?.nombre ?? 'Desconocido', unit: insumo?.unidad ?? ing.unit };
            }
            const subRecipe = await Recipe.findById(ing.ingredientRefId).lean();
            return { ...ing, name: subRecipe?.name ?? 'Sub-receta', unit: 'UND' };
          })
        );
        let packDetails = null;
        if (variant.disposablePackId) {
          packDetails = await DisposablePack.findById(variant.disposablePackId).lean();
        }
        return { ...variant, ingredients: enrichedIngredients, packDetails };
      })
    );

    res.json({ recipe: { ...recipe, variants: enrichedVariants }, params });
  } catch {
    res.status(500).json({ error: 'Error al obtener ficha técnica' });
  }
}
