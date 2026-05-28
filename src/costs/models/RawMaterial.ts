import mongoose, { Document, Schema } from 'mongoose';
import { MEASUREMENT_UNITS, MeasurementUnit } from '../../utils/measurementUnits';

export const RAW_MATERIAL_CATEGORIES = [
  'LACTEOS', 'BASES_POLVO', 'JARABES_SALSAS', 'CONCENTRADOS',
  'TE_INFUSIONES', 'CAFE', 'AGUA', 'VASOS_CARTON', 'VASOS_PLASTICO',
  'EXTRAS', 'SUPLEMENTOS', 'AZUCAR', 'POLVOS', 'FRUTAS_VERDURAS',
  'UNTABLES', 'HIELO', 'MODIFICADORES', 'POLLO', 'SYRUPS', 'PERLAS',
  'MATERIALES_PICNIC', 'DECORACION',
] as const;

export type RawMaterialCategory = typeof RAW_MATERIAL_CATEGORIES[number];
export interface IRawMaterial extends Document {
  category: RawMaterialCategory;
  name: string;
  presentation: string;
  purchaseUnit: MeasurementUnit;
  quantityPerPresentation: number;
  totalPrice: number;
  pricePerUnit: number;
  supplier: string;
  notes: string;
  minStock: number;
  importedFromExcel: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const rawMaterialSchema = new Schema<IRawMaterial>(
  {
    category: { type: String, enum: RAW_MATERIAL_CATEGORIES, required: true },
    name: { type: String, required: true, trim: true },
    presentation: { type: String, required: true, trim: true },
    purchaseUnit: { type: String, enum: MEASUREMENT_UNITS, required: true },
    quantityPerPresentation: { type: Number, required: true, min: 0.001 },
    totalPrice: { type: Number, required: true, min: 0 },
    pricePerUnit: { type: Number, default: 0 },
    supplier: { type: String, default: '' },
    notes: { type: String, default: '' },
    minStock: { type: Number, default: 0, min: 0 },
    importedFromExcel: { type: Boolean, default: false },
  },
  { timestamps: true }
);

rawMaterialSchema.pre('save', function (next) {
  if (this.quantityPerPresentation > 0) {
    const baseQuantity =
      this.purchaseUnit === 'KG' || this.purchaseUnit === 'LT'
        ? this.quantityPerPresentation * 1000
        : this.quantityPerPresentation;
    this.pricePerUnit = this.totalPrice / baseQuantity;
  }
  next();
});

export default mongoose.model<IRawMaterial>('RawMaterial', rawMaterialSchema);
