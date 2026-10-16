// Seed ADITIVO e idempotente del catálogo de catering (apto para producción).
// No borra nada: crea las categorías que falten y solo las recetas cuyo nombre
// no existe todavía (sin distinguir mayúsculas/tildes). Se puede correr varias veces.
//
//   npm run seed:catering -- --dry-run   # muestra qué haría, sin escribir
//   npm run seed:catering                # aplica
import mongoose from 'mongoose';
import { env } from '../../config/env';
import Recipe from '../models/Recipe';
import RecipeCategory, { DEFAULT_RECIPE_CATEGORIES } from '../models/RecipeCategory';
import { computeRecipeVariantCosts, getRecipeCostParams } from '../services/RecipeCostOrchestrator';
import { nameKey, normalizeCategoryValue, parseAndGroup } from '../services/RecipeImportService';
import { CATERING_PRODUCTS } from './cateringProducts';

const dryRun = process.argv.includes('--dry-run');

function describeTarget(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.host}${url.pathname}`;
  } catch {
    return '(URI no estándar)';
  }
}

async function main() {
  const { recipes, errors } = parseAndGroup(CATERING_PRODUCTS);
  if (errors.length > 0) {
    throw new Error(`Datos del catálogo inválidos: ${errors.map((e) => `fila ${e.row}: ${e.message}`).join('; ')}`);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Conectado a MongoDB → ${describeTarget(env.MONGODB_URI)}${dryRun ? '  [DRY RUN: no se escribirá nada]' : ''}`);

  // Si la colección está vacía, sembrar primero las categorías por defecto: la
  // app solo las crea cuando no hay ninguna, y la nuestra las taparía.
  if ((await RecipeCategory.countDocuments()) === 0) {
    console.log(`ℹ️  Sin categorías de recetas: se ${dryRun ? 'crearían' : 'crean'} las ${DEFAULT_RECIPE_CATEGORIES.length} por defecto primero.`);
    if (!dryRun) {
      await RecipeCategory.insertMany(DEFAULT_RECIPE_CATEGORIES.map((cat, idx) => ({ ...cat, orden: idx + 1 })));
    }
  }

  const categories = await RecipeCategory.find();
  const categoryValues = new Map<string, string>();
  for (const cat of categories) {
    categoryValues.set(cat.value, cat.value);
    categoryValues.set(normalizeCategoryValue(cat.label), cat.value);
  }

  const existingNames = new Set((await Recipe.find({ isSubRecipe: false }).select('name').lean()).map((r) => nameKey(r.name)));
  const params = dryRun ? null : await getRecipeCostParams();
  let nextOrden = ((await RecipeCategory.findOne().sort({ orden: -1 }).select('orden').lean())?.orden ?? 0) + 1;

  let created = 0;
  let skipped = 0;
  for (const recipe of recipes) {
    if (existingNames.has(nameKey(recipe.name))) {
      console.log(`⏭️  Ya existe: ${recipe.name}`);
      skipped++;
      continue;
    }

    const value = normalizeCategoryValue(recipe.categoryLabel);
    let category = categoryValues.get(value);
    if (!category) {
      category = value;
      categoryValues.set(value, value);
      console.log(`➕ Categoría nueva: ${recipe.categoryLabel} (${value})`);
      if (!dryRun) await RecipeCategory.create({ value, label: recipe.categoryLabel, orden: nextOrden++ });
    }

    console.log(`${dryRun ? '📝' : '✅'} ${recipe.name} — ${recipe.categoryLabel} — $${recipe.variants[0].salePrice}`);
    created++;
    if (dryRun) continue;

    const doc = new Recipe({
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
        disposablePackId: null,
        salePrice: v.salePrice,
        taxType: v.taxType,
        taxRate: v.taxRate,
        taxIncluded: true,
        costingMethod: 'food-cost',
      })),
    });
    await computeRecipeVariantCosts(doc, params!);
    await doc.save();
  }

  console.log(`\n${dryRun ? 'Se crearían' : 'Creadas'}: ${created} · Omitidas (ya existían): ${skipped}`);
  if (!dryRun) console.log('Los ingredientes y costos de estas recetas se agregan después, desde Recetas.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
