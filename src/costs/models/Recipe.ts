import mongoose, { Document, Schema } from 'mongoose';
import { MEASUREMENT_UNITS, MeasurementUnit } from '../../utils/measurementUnits';

export type RecipeCategory = string;

export const VARIANT_SIZES = ['6OZ', '8OZ', '12OZ', '16OZ', '20OZ', 'UND'] as const;
export type VariantSize = typeof VARIANT_SIZES[number];

export const INGREDIENT_UNITS = MEASUREMENT_UNITS;
export type IngredientUnit = MeasurementUnit;

export interface IRecipeIngredient {
  ingredientRefId: mongoose.Types.ObjectId;
  ingredientType: 'raw' | 'recipe';
  quantity: number;
  unit: IngredientUnit;
  cost: number;
  includePreparationTime?: boolean;
}

export interface IVariant {
  size: VariantSize;
  ingredients: IRecipeIngredient[];
  disposablePackId?: mongoose.Types.ObjectId;
  salePrice: number;
  taxType?: 'NONE' | 'IVA_19' | 'CONSUMO_8';
  taxRate?: number;
  taxIncluded?: boolean;
  salePriceWithoutTax: number;
  taxAmount?: number;
  finalPrice?: number;
  targetMargin?: number;
  totalPreparationTimeMinutes: number;
  directMaterialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  profitAmount: number;
  profitPct: number;
  grossMarginPct: number;
  suggestedPrice: number;
}

export interface IRecipe extends Document {
  name: string;
  description: string;
  imageUrl: string;
  category: RecipeCategory;
  isSubRecipe: boolean;
  isProduct: boolean;
  preparationTimeMinutes: number;
  variants: IVariant[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const recipeIngredientSchema = new Schema<IRecipeIngredient>(
  {
    ingredientRefId: { type: Schema.Types.ObjectId, required: true },
    ingredientType: { type: String, enum: ['raw', 'recipe'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: INGREDIENT_UNITS, required: true },
    cost: { type: Number, default: 0 },
    includePreparationTime: { type: Boolean, default: false },
  },
  { _id: false }
);

const variantSchema = new Schema<IVariant>(
  {
    size: { type: String, enum: VARIANT_SIZES, required: true },
    ingredients: [recipeIngredientSchema],
    disposablePackId: { type: Schema.Types.ObjectId, ref: 'DisposablePack', default: null },
    salePrice: { type: Number, default: 0, min: 0 },
    taxType: { type: String, enum: ['NONE', 'IVA_19', 'CONSUMO_8'], default: 'IVA_19' },
    taxRate: { type: Number, default: 0.19, min: 0, max: 1 },
    taxIncluded: { type: Boolean, default: true },
    salePriceWithoutTax: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    finalPrice: { type: Number, default: 0 },
    targetMargin: { type: Number, default: null },
    totalPreparationTimeMinutes: { type: Number, default: 0, min: 0 },
    directMaterialCost: { type: Number, default: 0 },
    laborCost: { type: Number, default: 0 },
    overheadCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    profitAmount: { type: Number, default: 0 },
    profitPct: { type: Number, default: 0 },
    grossMarginPct: { type: Number, default: 0 },
    suggestedPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const recipeSchema = new Schema<IRecipe>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    category: { type: String, required: true, trim: true, uppercase: true },
    isSubRecipe: { type: Boolean, default: false },
    isProduct: { type: Boolean, default: false },
    preparationTimeMinutes: { type: Number, default: 0, min: 0 },
    variants: [variantSchema],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IRecipe>('Recipe', recipeSchema);
