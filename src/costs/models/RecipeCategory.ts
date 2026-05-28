import mongoose, { Document, Schema } from 'mongoose';

export const DEFAULT_RECIPE_CATEGORIES = [
  { value: 'CAFE_CALIENTE', label: 'Café caliente' },
  { value: 'CAFE_FRIO', label: 'Café frío' },
  { value: 'METODOS_ESPECIALES', label: 'Métodos especiales' },
  { value: 'BEBIDA_SIN_CAFE', label: 'Bebida sin café' },
  { value: 'MATCHA', label: 'Matcha' },
  { value: 'CHAI', label: 'Chai' },
  { value: 'CHOCOLATE', label: 'Chocolate' },
  { value: 'REFRESHER', label: 'Refresher' },
  { value: 'PROTEINA', label: 'Proteína' },
  { value: 'WAFFLE', label: 'Waffle' },
  { value: 'PICNIC_BOX', label: 'Picnic Box' },
  { value: 'EXPERIENCIA_CENA', label: 'Experiencia cena' },
  { value: 'OTRO', label: 'Otro' },
];

export interface IRecipeCategory extends Document {
  value: string;
  label: string;
  orden: number;
}

const recipeCategorySchema = new Schema<IRecipeCategory>(
  {
    value: { type: String, required: true, trim: true, uppercase: true, unique: true },
    label: { type: String, required: true, trim: true },
    orden: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IRecipeCategory>('RecipeCategory', recipeCategorySchema);
