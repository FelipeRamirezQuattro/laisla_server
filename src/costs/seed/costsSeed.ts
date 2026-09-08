import mongoose from 'mongoose';
import { env } from '../../config/env';
import Insumo from '../../inventario/models/Insumo';
import InsumoCategoria from '../../inventario/models/InsumoCategoria';
import DisposablePack from '../models/DisposablePack';
import LaborAndOverheadParams from '../models/LaborAndOverheadParams';
import Recipe from '../models/Recipe';
import { calcMOD, calcGIF } from '../services/CostCalculationService';

const CATEGORY_LABELS: Record<string, string> = {
  CAFE: 'Café',
  LACTEOS: 'Lácteos',
  BASES_POLVO: 'Bases en polvo',
  POLVOS: 'Polvos',
  CONCENTRADOS: 'Concentrados',
  JARABES_SALSAS: 'Jarabes y salsas',
  AZUCAR: 'Azúcar',
  VASOS_CARTON: 'Vasos de cartón',
  VASOS_PLASTICO: 'Vasos de plástico',
  EXTRAS: 'Extras',
  FRUTAS_VERDURAS: 'Frutas y verduras',
  POLLO: 'Pollo',
  UNTABLES: 'Untables',
  HIELO: 'Hielo',
  AGUA: 'Agua',
  SYRUPS: 'Syrups',
  MATERIALES_PICNIC: 'Materiales picnic',
  DECORACION: 'Decoración',
};

interface SeedMaterial {
  category: keyof typeof CATEGORY_LABELS;
  name: string;
  purchaseUnit: 'GR' | 'ML' | 'UND';
  quantityPerPresentation: number;
  minStock: number;
}

const RAW_MATERIALS: SeedMaterial[] = [
  // CAFE
  { category: 'CAFE', name: 'Café espresso molido', purchaseUnit: 'GR', quantityPerPresentation: 1000, minStock: 200 },
  { category: 'CAFE', name: 'Café para métodos filtrado', purchaseUnit: 'GR', quantityPerPresentation: 500, minStock: 100 },
  // LACTEOS
  { category: 'LACTEOS', name: 'Leche entera Colanta', purchaseUnit: 'ML', quantityPerPresentation: 12000, minStock: 2000 },
  { category: 'LACTEOS', name: 'Crema de leche', purchaseUnit: 'ML', quantityPerPresentation: 1000, minStock: 500 },
  // BASES_POLVO
  { category: 'BASES_POLVO', name: 'Cacao en polvo sin azúcar', purchaseUnit: 'GR', quantityPerPresentation: 1000, minStock: 200 },
  { category: 'BASES_POLVO', name: 'Harina de trigo para waffle', purchaseUnit: 'GR', quantityPerPresentation: 2000, minStock: 500 },
  // MATCHA
  { category: 'POLVOS', name: 'Matcha ceremonial en polvo', purchaseUnit: 'GR', quantityPerPresentation: 100, minStock: 30 },
  // CHAI
  { category: 'CONCENTRADOS', name: 'Chai base concentrado', purchaseUnit: 'GR', quantityPerPresentation: 250, minStock: 50 },
  // JARABES_SALSAS
  { category: 'JARABES_SALSAS', name: 'Jarabe de vainilla', purchaseUnit: 'ML', quantityPerPresentation: 750, minStock: 100 },
  { category: 'JARABES_SALSAS', name: 'Arequipe / dulce de leche', purchaseUnit: 'GR', quantityPerPresentation: 500, minStock: 100 },
  { category: 'JARABES_SALSAS', name: 'Salsa de chocolate', purchaseUnit: 'ML', quantityPerPresentation: 500, minStock: 100 },
  // AZUCAR
  { category: 'AZUCAR', name: 'Azúcar blanca', purchaseUnit: 'GR', quantityPerPresentation: 1000, minStock: 300 },
  { category: 'AZUCAR', name: 'Azúcar sobres individuales', purchaseUnit: 'UND', quantityPerPresentation: 100, minStock: 50 },
  // VASOS_CARTON
  { category: 'VASOS_CARTON', name: 'Vaso cartón 6oz', purchaseUnit: 'UND', quantityPerPresentation: 50, minStock: 20 },
  { category: 'VASOS_CARTON', name: 'Vaso cartón 8oz', purchaseUnit: 'UND', quantityPerPresentation: 50, minStock: 20 },
  { category: 'VASOS_CARTON', name: 'Vaso cartón 12oz', purchaseUnit: 'UND', quantityPerPresentation: 50, minStock: 20 },
  { category: 'VASOS_CARTON', name: 'Vaso cartón 16oz', purchaseUnit: 'UND', quantityPerPresentation: 50, minStock: 20 },
  { category: 'VASOS_CARTON', name: 'Tapa vaso cartón', purchaseUnit: 'UND', quantityPerPresentation: 100, minStock: 40 },
  { category: 'VASOS_CARTON', name: 'Fajilla protectora cartón', purchaseUnit: 'UND', quantityPerPresentation: 100, minStock: 40 },
  // VASOS_PLASTICO
  { category: 'VASOS_PLASTICO', name: 'Vaso plástico PET 12oz', purchaseUnit: 'UND', quantityPerPresentation: 50, minStock: 20 },
  { category: 'VASOS_PLASTICO', name: 'Vaso plástico PET 16oz', purchaseUnit: 'UND', quantityPerPresentation: 50, minStock: 20 },
  { category: 'VASOS_PLASTICO', name: 'Vaso plástico PET 20oz', purchaseUnit: 'UND', quantityPerPresentation: 50, minStock: 20 },
  { category: 'VASOS_PLASTICO', name: 'Tapa domo vaso plástico', purchaseUnit: 'UND', quantityPerPresentation: 100, minStock: 40 },
  { category: 'VASOS_PLASTICO', name: 'Pitillo / popote biodegradable', purchaseUnit: 'UND', quantityPerPresentation: 100, minStock: 40 },
  // EXTRAS
  { category: 'EXTRAS', name: 'Agitador de madera', purchaseUnit: 'UND', quantityPerPresentation: 100, minStock: 30 },
  // FRUTAS_VERDURAS
  { category: 'FRUTAS_VERDURAS', name: 'Fresas frescas', purchaseUnit: 'GR', quantityPerPresentation: 500, minStock: 100 },
  { category: 'FRUTAS_VERDURAS', name: 'Plátano maduro', purchaseUnit: 'UND', quantityPerPresentation: 1, minStock: 5 },
  { category: 'FRUTAS_VERDURAS', name: 'Limón', purchaseUnit: 'UND', quantityPerPresentation: 1, minStock: 10 },
  // POLLO
  { category: 'POLLO', name: 'Pechuga de pollo cocida y desmechada', purchaseUnit: 'GR', quantityPerPresentation: 500, minStock: 100 },
  // UNTABLES
  { category: 'UNTABLES', name: 'Queso campesino', purchaseUnit: 'GR', quantityPerPresentation: 500, minStock: 100 },
  // HIELO
  { category: 'HIELO', name: 'Hielo en cubos', purchaseUnit: 'GR', quantityPerPresentation: 2000, minStock: 500 },
  // AGUA
  { category: 'AGUA', name: 'Agua filtrada / para métodos', purchaseUnit: 'ML', quantityPerPresentation: 20000, minStock: 2000 },
  // SYRUPS
  { category: 'SYRUPS', name: 'Jarabe de coco', purchaseUnit: 'ML', quantityPerPresentation: 750, minStock: 100 },
  // MATERIALES_PICNIC
  { category: 'MATERIALES_PICNIC', name: 'Caja kraft individual', purchaseUnit: 'UND', quantityPerPresentation: 10, minStock: 5 },
  { category: 'MATERIALES_PICNIC', name: 'Caja kraft grupal', purchaseUnit: 'UND', quantityPerPresentation: 5, minStock: 3 },
  { category: 'MATERIALES_PICNIC', name: 'Servilletas de tela', purchaseUnit: 'UND', quantityPerPresentation: 10, minStock: 10 },
  { category: 'MATERIALES_PICNIC', name: 'Cubiertos biodegradables set', purchaseUnit: 'UND', quantityPerPresentation: 10, minStock: 5 },
  // DECORACION
  { category: 'DECORACION', name: 'Etiqueta decorativa La Isla', purchaseUnit: 'UND', quantityPerPresentation: 50, minStock: 10 },
  { category: 'DECORACION', name: 'Flores secas decoración', purchaseUnit: 'UND', quantityPerPresentation: 1, minStock: 1 },
];

async function seedInsumosCosteo() {
  // Reuses the shared Insumo/InsumoCategoria collections (daily-inventory module) —
  // this is the single catalog the costing/recipe engine reads at runtime.
  const categoryOrder = Object.keys(CATEGORY_LABELS);
  const categorias = await InsumoCategoria.insertMany(
    categoryOrder.map((key, index) => ({ nombre: CATEGORY_LABELS[key], orden: index + 1 }))
  );
  const categoriaIdByKey = new Map(categoryOrder.map((key, index) => [key, categorias[index]._id]));

  const ordenByCategory = new Map<string, number>();
  const docs = RAW_MATERIALS.map((m) => {
    const orden = (ordenByCategory.get(m.category) ?? 0) + 1;
    ordenByCategory.set(m.category, orden);
    return {
      nombre: m.name,
      categoriaId: categoriaIdByKey.get(m.category)!,
      unidad: m.purchaseUnit,
      cantidadPresentacion: m.quantityPerPresentation,
      orden,
    };
  });

  const insumos = await Insumo.insertMany(docs);
  console.log(`✅ ${categorias.length} categorías y ${insumos.length} insumos creados`);
  return insumos;
}

async function seedLaborAndOverhead() {
  await LaborAndOverheadParams.deleteMany({});

  const raw = {
    hourlyWage: 0,
    numberOfWorkers: 2,
    hoursPerDay: 8,
    numberOfShifts: 1,
    monthlyCustomers: 600,
    productsPerCustomer: 2,
    overheadItems: [
      { concept: 'Arriendo', monthlyCost: 0 },
      { concept: 'Energía', monthlyCost: 0 },
      { concept: 'Internet', monthlyCost: 0 },
      { concept: 'Agua', monthlyCost: 0 },
      { concept: 'Mantenimiento', monthlyCost: 0 },
      { concept: 'Marketing digital', monthlyCost: 0 },
      { concept: 'Pauta', monthlyCost: 0 },
      { concept: 'Software', monthlyCost: 0 },
      { concept: 'Derechos musicales (Sayco/Acinpro)', monthlyCost: 0 },
      { concept: 'Contabilidad', monthlyCost: 0 },
      { concept: 'Imprevistos', monthlyCost: 0 },
    ],
    ivaRate: 0.19,
  };

  const mod = calcMOD(raw);
  const gif = calcGIF({ overheadItems: raw.overheadItems, monthlyCustomers: raw.monthlyCustomers, productsPerCustomer: raw.productsPerCustomer });

  const params = await LaborAndOverheadParams.create({ ...raw, ...mod, ...gif });
  console.log('✅ Parámetros MOD/GIF creados');
  return params;
}

async function seedDisposablePacks(materials: InstanceType<typeof Insumo>[]) {
  await DisposablePack.deleteMany({});

  const byName = (name: string) => materials.find((m) => m.nombre === name)?._id ?? null;

  const packs = await DisposablePack.insertMany([
    {
      name: 'Caliente 6oz',
      items: [
        { rawMaterialId: byName('Vaso cartón 6oz'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Tapa vaso cartón'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Fajilla protectora cartón'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Azúcar sobres individuales'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Agitador de madera'), quantity: 1, unit: 'UND', cost: 0 },
      ],
      totalCost: 0,
    },
    {
      name: 'Caliente 8oz',
      items: [
        { rawMaterialId: byName('Vaso cartón 8oz'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Tapa vaso cartón'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Fajilla protectora cartón'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Azúcar sobres individuales'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Agitador de madera'), quantity: 1, unit: 'UND', cost: 0 },
      ],
      totalCost: 0,
    },
    {
      name: 'Caliente 12oz',
      items: [
        { rawMaterialId: byName('Vaso cartón 12oz'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Tapa vaso cartón'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Fajilla protectora cartón'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Azúcar sobres individuales'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Agitador de madera'), quantity: 1, unit: 'UND', cost: 0 },
      ],
      totalCost: 0,
    },
    {
      name: 'Caliente 16oz',
      items: [
        { rawMaterialId: byName('Vaso cartón 16oz'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Tapa vaso cartón'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Fajilla protectora cartón'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Azúcar sobres individuales'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Agitador de madera'), quantity: 1, unit: 'UND', cost: 0 },
      ],
      totalCost: 0,
    },
    {
      name: 'Frío 12oz',
      items: [
        { rawMaterialId: byName('Vaso plástico PET 12oz'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Tapa domo vaso plástico'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Pitillo / popote biodegradable'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Azúcar sobres individuales'), quantity: 1, unit: 'UND', cost: 0 },
      ],
      totalCost: 0,
    },
    {
      name: 'Frío 16oz',
      items: [
        { rawMaterialId: byName('Vaso plástico PET 16oz'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Tapa domo vaso plástico'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Pitillo / popote biodegradable'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Azúcar sobres individuales'), quantity: 1, unit: 'UND', cost: 0 },
      ],
      totalCost: 0,
    },
    {
      name: 'Picnic Individual',
      items: [
        { rawMaterialId: byName('Caja kraft individual'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Servilletas de tela'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Cubiertos biodegradables set'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Etiqueta decorativa La Isla'), quantity: 1, unit: 'UND', cost: 0 },
      ],
      totalCost: 0,
    },
    {
      name: 'Picnic Grupal (por persona)',
      items: [
        { rawMaterialId: byName('Caja kraft grupal'), quantity: 0.25, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Servilletas de tela'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Cubiertos biodegradables set'), quantity: 1, unit: 'UND', cost: 0 },
        { rawMaterialId: byName('Etiqueta decorativa La Isla'), quantity: 1, unit: 'UND', cost: 0 },
      ],
      totalCost: 0,
    },
  ]);

  console.log(`✅ ${packs.length} packs de desechables creados`);
  return packs;
}

async function seedRecipes(materials: InstanceType<typeof Insumo>[]) {
  await Recipe.deleteMany({});

  const mat = (name: string) => materials.find((m) => m.nombre === name)?._id;

  const ing = (name: string, quantity: number, unit: 'GR' | 'ML' | 'UND') => ({
    ingredientRefId: mat(name),
    ingredientType: 'raw' as const,
    quantity,
    unit,
    cost: 0,
  });

  // Sub-receta: Base Waffle Estándar (rinde 8 waffles)
  const [baseWaffle] = await Recipe.insertMany([
    {
      name: 'Base Waffle Estándar',
      category: 'WAFFLE',
      isSubRecipe: true,
      active: true,
      variants: [{
        size: 'UND',
        ingredients: [
          ing('Harina de trigo para waffle', 250, 'GR'),
          ing('Leche entera Colanta', 200, 'ML'),
          ing('Azúcar blanca', 20, 'GR'),
        ],
        salePrice: 0, salePriceWithoutTax: 0, targetMargin: null,
        directMaterialCost: 0, laborCost: 0, overheadCost: 0,
        totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0,
      }],
    },
  ]);

  const subRecipeIng = (name: string, quantity: number) => ({
    ingredientRefId: baseWaffle._id,
    ingredientType: 'recipe' as const,
    quantity,
    unit: 'UND' as const,
    cost: 0,
  });

  await Recipe.insertMany([
    // ── CAFÉ CALIENTE ──────────────────────────────────────────
    {
      name: 'Espresso', category: 'CAFE_CALIENTE', active: true,
      variants: [
        { size: '6OZ', ingredients: [ing('Café espresso molido', 18, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Doble Espresso', category: 'CAFE_CALIENTE', active: true,
      variants: [
        { size: '6OZ', ingredients: [ing('Café espresso molido', 36, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Americano', category: 'CAFE_CALIENTE', active: true,
      variants: [
        { size: '8OZ', ingredients: [ing('Café espresso molido', 18, 'GR'), ing('Agua filtrada / para métodos', 150, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
        { size: '12OZ', ingredients: [ing('Café espresso molido', 18, 'GR'), ing('Agua filtrada / para métodos', 250, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Latte', category: 'CAFE_CALIENTE', active: true,
      variants: [
        { size: '8OZ', ingredients: [ing('Café espresso molido', 18, 'GR'), ing('Leche entera Colanta', 160, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
        { size: '12OZ', ingredients: [ing('Café espresso molido', 18, 'GR'), ing('Leche entera Colanta', 250, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
        { size: '16OZ', ingredients: [ing('Café espresso molido', 36, 'GR'), ing('Leche entera Colanta', 350, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Capuchino', category: 'CAFE_CALIENTE', active: true,
      variants: [
        { size: '8OZ', ingredients: [ing('Café espresso molido', 18, 'GR'), ing('Leche entera Colanta', 120, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Mocha', category: 'CAFE_CALIENTE', active: true,
      variants: [
        { size: '12OZ', ingredients: [ing('Café espresso molido', 18, 'GR'), ing('Leche entera Colanta', 200, 'ML'), ing('Salsa de chocolate', 20, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Chocolate caliente', category: 'CAFE_CALIENTE', active: true,
      variants: [
        { size: '8OZ', ingredients: [ing('Cacao en polvo sin azúcar', 20, 'GR'), ing('Leche entera Colanta', 200, 'ML'), ing('Azúcar blanca', 15, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
        { size: '12OZ', ingredients: [ing('Cacao en polvo sin azúcar', 25, 'GR'), ing('Leche entera Colanta', 300, 'ML'), ing('Azúcar blanca', 20, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Chai Latte', category: 'CAFE_CALIENTE', active: true,
      variants: [
        { size: '12OZ', ingredients: [ing('Chai base concentrado', 25, 'GR'), ing('Leche entera Colanta', 250, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Matcha Latte', category: 'CAFE_CALIENTE', active: true,
      variants: [
        { size: '8OZ', ingredients: [ing('Matcha ceremonial en polvo', 5, 'GR'), ing('Leche entera Colanta', 180, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
        { size: '12OZ', ingredients: [ing('Matcha ceremonial en polvo', 7, 'GR'), ing('Leche entera Colanta', 270, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Tinto tolimense', category: 'CAFE_CALIENTE', active: true,
      variants: [
        { size: '6OZ', ingredients: [ing('Café para métodos filtrado', 12, 'GR'), ing('Agua filtrada / para métodos', 120, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    // ── CAFÉ FRÍO ──────────────────────────────────────────────
    {
      name: 'Americano frío', category: 'CAFE_FRIO', active: true,
      variants: [
        { size: '12OZ', ingredients: [ing('Café espresso molido', 18, 'GR'), ing('Agua filtrada / para métodos', 200, 'ML'), ing('Hielo en cubos', 100, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Latte frío', category: 'CAFE_FRIO', active: true,
      variants: [
        { size: '12OZ', ingredients: [ing('Café espresso molido', 18, 'GR'), ing('Leche entera Colanta', 200, 'ML'), ing('Hielo en cubos', 100, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
        { size: '16OZ', ingredients: [ing('Café espresso molido', 36, 'GR'), ing('Leche entera Colanta', 300, 'ML'), ing('Hielo en cubos', 150, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Cold Brew', category: 'CAFE_FRIO', active: true,
      variants: [
        { size: '12OZ', ingredients: [ing('Café para métodos filtrado', 30, 'GR'), ing('Agua filtrada / para métodos', 300, 'ML'), ing('Hielo en cubos', 100, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    {
      name: 'Capuchino frío', category: 'CAFE_FRIO', active: true,
      variants: [
        { size: '12OZ', ingredients: [ing('Café espresso molido', 18, 'GR'), ing('Leche entera Colanta', 150, 'ML'), ing('Hielo en cubos', 100, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
        { size: '16OZ', ingredients: [ing('Café espresso molido', 36, 'GR'), ing('Leche entera Colanta', 220, 'ML'), ing('Hielo en cubos', 150, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 },
      ],
    },
    // ── MÉTODOS ESPECIALES ────────────────────────────────────
    {
      name: 'V60', category: 'METODOS_ESPECIALES', active: true,
      variants: [{ size: '8OZ', ingredients: [ing('Café para métodos filtrado', 15, 'GR'), ing('Agua filtrada / para métodos', 250, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 }],
    },
    {
      name: 'Chemex', category: 'METODOS_ESPECIALES', active: true,
      variants: [{ size: '12OZ', ingredients: [ing('Café para métodos filtrado', 30, 'GR'), ing('Agua filtrada / para métodos', 500, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 }],
    },
    {
      name: 'AeroPress', category: 'METODOS_ESPECIALES', active: true,
      variants: [{ size: '8OZ', ingredients: [ing('Café para métodos filtrado', 18, 'GR'), ing('Agua filtrada / para métodos', 200, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 }],
    },
    {
      name: 'Prensa francesa', category: 'METODOS_ESPECIALES', active: true,
      variants: [{ size: '12OZ', ingredients: [ing('Café para métodos filtrado', 25, 'GR'), ing('Agua filtrada / para métodos', 400, 'ML')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 }],
    },
    // ── BEBIDA SIN CAFÉ ────────────────────────────────────────
    {
      name: 'Chocolate frío', category: 'BEBIDA_SIN_CAFE', active: true,
      variants: [{ size: '12OZ', ingredients: [ing('Cacao en polvo sin azúcar', 25, 'GR'), ing('Leche entera Colanta', 250, 'ML'), ing('Azúcar blanca', 20, 'GR'), ing('Hielo en cubos', 100, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 }],
    },
    {
      name: 'Matcha frío', category: 'MATCHA', active: true,
      variants: [{ size: '12OZ', ingredients: [ing('Matcha ceremonial en polvo', 7, 'GR'), ing('Leche entera Colanta', 250, 'ML'), ing('Hielo en cubos', 100, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 }],
    },
    {
      name: 'Chai frío', category: 'CHAI', active: true,
      variants: [{ size: '12OZ', ingredients: [ing('Chai base concentrado', 25, 'GR'), ing('Leche entera Colanta', 200, 'ML'), ing('Hielo en cubos', 100, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 }],
    },
    {
      name: 'Limonada de coco', category: 'BEBIDA_SIN_CAFE', active: true,
      variants: [{ size: '16OZ', ingredients: [ing('Limón', 2, 'UND'), ing('Jarabe de coco', 30, 'ML'), ing('Agua filtrada / para métodos', 200, 'ML'), ing('Hielo en cubos', 150, 'GR')], salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0 }],
    },
    // ── WAFFLES (usan sub-receta Base Waffle) ─────────────────
    {
      name: 'Waffle con arequipe y plátano', category: 'WAFFLE', active: true,
      variants: [{
        size: 'UND',
        ingredients: [
          subRecipeIng('Base Waffle Estándar', 0.125),
          ing('Arequipe / dulce de leche', 40, 'GR'),
          ing('Plátano maduro', 0.5, 'UND'),
        ],
        salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0,
      }],
    },
    {
      name: 'Waffle con frutas rojas', category: 'WAFFLE', active: true,
      variants: [{
        size: 'UND',
        ingredients: [
          subRecipeIng('Base Waffle Estándar', 0.125),
          ing('Fresas frescas', 60, 'GR'),
          ing('Jarabe de vainilla', 15, 'ML'),
        ],
        salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0,
      }],
    },
    {
      name: 'Waffle salado con pollo y queso', category: 'WAFFLE', active: true,
      variants: [{
        size: 'UND',
        ingredients: [
          subRecipeIng('Base Waffle Estándar', 0.125),
          ing('Pechuga de pollo cocida y desmechada', 80, 'GR'),
          ing('Queso campesino', 30, 'GR'),
        ],
        salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0,
      }],
    },
    // ── PICNIC BOX ────────────────────────────────────────────
    {
      name: 'Picnic Individual (1 persona)', category: 'PICNIC_BOX', active: true,
      variants: [{
        size: 'UND',
        ingredients: [
          ing('Caja kraft individual', 1, 'UND'),
          ing('Flores secas decoración', 1, 'UND'),
        ],
        salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0,
      }],
    },
    {
      name: 'Picnic Pareja (2 personas)', category: 'PICNIC_BOX', active: true,
      variants: [{
        size: 'UND',
        ingredients: [
          ing('Caja kraft individual', 2, 'UND'),
          ing('Flores secas decoración', 1, 'UND'),
          ing('Servilletas de tela', 2, 'UND'),
        ],
        salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0,
      }],
    },
    {
      name: 'Picnic Grupal (por persona)', category: 'PICNIC_BOX', active: true,
      variants: [{
        size: 'UND',
        ingredients: [
          ing('Caja kraft grupal', 0.25, 'UND'),
          ing('Servilletas de tela', 1, 'UND'),
          ing('Cubiertos biodegradables set', 1, 'UND'),
        ],
        salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0,
      }],
    },
    // ── EXPERIENCIAS ──────────────────────────────────────────
    {
      name: 'Cena con Desconocidos', category: 'EXPERIENCIA_CENA', active: true,
      variants: [{
        size: 'UND',
        ingredients: [
          ing('Flores secas decoración', 1, 'UND'),
          ing('Servilletas de tela', 1, 'UND'),
          ing('Cubiertos biodegradables set', 1, 'UND'),
        ],
        salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0,
      }],
    },
    {
      name: 'Cata Express de Café Tolimense', category: 'EXPERIENCIA_CENA', active: true,
      variants: [{
        size: 'UND',
        ingredients: [
          ing('Café para métodos filtrado', 30, 'GR'),
          ing('Agua filtrada / para métodos', 400, 'ML'),
        ],
        salePrice: 0, salePriceWithoutTax: 0, directMaterialCost: 0, laborCost: 0, overheadCost: 0, totalCost: 0, profitAmount: 0, profitPct: 0, grossMarginPct: 0, suggestedPrice: 0,
      }],
    },
  ]);

  const total = await Recipe.countDocuments();
  console.log(`✅ ${total} recetas creadas (incluyendo sub-receta Base Waffle)`);
}

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Conectado a MongoDB');

  await InsumoCategoria.deleteMany({});
  await Insumo.deleteMany({});
  const insumos = await seedInsumosCosteo();
  await seedLaborAndOverhead();
  await seedDisposablePacks(insumos);
  await seedRecipes(insumos);

  console.log('\n🎉 Seed de costos completado.');
  console.log('   Recuerda ingresar los precios reales de insumos y precios de venta en el panel.');
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
