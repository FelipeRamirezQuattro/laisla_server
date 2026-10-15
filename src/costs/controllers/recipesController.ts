import { Response } from 'express';
import { AuthRequest } from '../../types';
import Recipe from '../models/Recipe';
import RecipeCategory, { DEFAULT_RECIPE_CATEGORIES } from '../models/RecipeCategory';
import Insumo from '../../inventario/models/Insumo';
import DisposablePack from '../models/DisposablePack';
import LaborAndOverheadParams from '../models/LaborAndOverheadParams';
import { MAX_IMPORT_ROWS, RecipeImportRow, nameKey, normalizeCategoryValue, parseAndGroup } from '../services/RecipeImportService';
import { computeRecipeVariantCosts, getRecipeCostParams } from '../services/RecipeCostOrchestrator';


async function ensureDefaultRecipeCategories(): Promise<void> {
  const count = await RecipeCategory.countDocuments();
  if (count > 0) return;
  await RecipeCategory.insertMany(
    DEFAULT_RECIPE_CATEGORIES.map((cat, idx) => ({ ...cat, orden: idx + 1 })),
    { ordered: false }
  );
}

async function computeVariantCosts(recipe: InstanceType<typeof Recipe>): Promise<void> {
  const params = await getRecipeCostParams();
  await computeRecipeVariantCosts(recipe, params);
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

// Importación masiva de recetas-producto (una variante por fila del Excel).
// dryRun=true solo valida y devuelve la vista previa; sin dryRun crea.
export async function importRecipes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const rows = req.body?.rows as RecipeImportRow[] | undefined;
    const dryRun = Boolean(req.body?.dryRun);
    if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: 'El archivo no tiene filas para importar' }); return; }
    if (rows.length > MAX_IMPORT_ROWS) { res.status(400).json({ error: `Máximo ${MAX_IMPORT_ROWS} filas por importación` }); return; }

    const { recipes, errors } = parseAndGroup(rows);

    await ensureDefaultRecipeCategories();
    const categories = await RecipeCategory.find();
    const categoryByKey = new Map<string, string>();
    for (const cat of categories) {
      categoryByKey.set(cat.value, cat.value);
      categoryByKey.set(normalizeCategoryValue(cat.label), cat.value);
    }

    const existing = await Recipe.find({ isSubRecipe: false }).select('name').lean();
    const existingNames = new Set(existing.map((r) => nameKey(r.name)));

    const skipped: Array<{ name: string; reason: string }> = [];
    const newCategories = new Map<string, string>(); // value -> label
    const toCreate = recipes.flatMap((recipe) => {
      if (existingNames.has(nameKey(recipe.name))) {
        skipped.push({ name: recipe.name, reason: 'Ya existe una receta con ese nombre' });
        return [];
      }
      const value = normalizeCategoryValue(recipe.categoryLabel);
      const resolved = categoryByKey.get(value);
      if (!resolved) newCategories.set(value, recipe.categoryLabel);
      return [{ recipe, category: resolved ?? value, isNewCategory: !resolved }];
    });

    const preview = toCreate.map(({ recipe, category, isNewCategory }) => ({
      name: recipe.name,
      category,
      isNewCategory,
      variants: recipe.variants.map((v) => ({ size: v.size, salePrice: v.salePrice, taxType: v.taxType })),
    }));

    if (dryRun) {
      res.json({ dryRun: true, toCreate: preview, skipped, errors, newCategories: [...newCategories.values()] });
      return;
    }

    // Una receta con error de fila nunca llega aquí (parseAndGroup la descarta),
    // pero si hubiera errores el usuario ya los vio en la vista previa.
    if (newCategories.size > 0) {
      const max = await RecipeCategory.findOne().sort({ orden: -1 }).select('orden').lean();
      let orden = max?.orden ?? 0;
      await RecipeCategory.insertMany(
        [...newCategories.entries()].map(([value, label]) => ({ value, label, orden: ++orden }))
      );
    }

    let created = 0;
    const failed: Array<{ name: string; reason: string }> = [];
    for (const { recipe, category } of toCreate) {
      try {
        const doc = new Recipe(
          normalizeRecipePayload({
            name: recipe.name,
            category,
            description: recipe.description,
            isSubRecipe: false,
            isProduct: true,
            preparationTimeMinutes: recipe.preparationTimeMinutes,
            active: recipe.active,
            variants: recipe.variants.map((v) => ({
              size: v.size,
              ingredients: [],
              salePrice: v.salePrice,
              taxType: v.taxType,
              taxRate: v.taxRate,
              taxIncluded: true,
              costingMethod: 'food-cost',
            })),
          })
        );
        await computeVariantCosts(doc);
        await doc.save();
        created++;
      } catch (err) {
        failed.push({ name: recipe.name, reason: String(err) });
      }
    }

    res.status(201).json({ dryRun: false, created, skipped, errors, failed, newCategories: [...newCategories.values()] });
  } catch (err) {
    res.status(500).json({ error: 'Error al importar recetas', details: String(err) });
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
