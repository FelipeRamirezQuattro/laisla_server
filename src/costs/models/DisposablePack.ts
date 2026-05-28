import mongoose, { Document, Schema } from 'mongoose';
import { MEASUREMENT_UNITS, MeasurementUnit } from '../../utils/measurementUnits';

export interface IDisposablePackItem {
  rawMaterialId: mongoose.Types.ObjectId;
  quantity: number;
  unit: MeasurementUnit;
  cost: number;
}

export interface IDisposablePack extends Document {
  name: string;
  items: IDisposablePackItem[];
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
}

const disposablePackItemSchema = new Schema<IDisposablePackItem>(
  {
    rawMaterialId: { type: Schema.Types.ObjectId, ref: 'Insumo', required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: MEASUREMENT_UNITS, required: true },
    cost: { type: Number, default: 0 },
  },
  { _id: false }
);

const disposablePackSchema = new Schema<IDisposablePack>(
  {
    name: { type: String, required: true, trim: true },
    items: [disposablePackItemSchema],
    totalCost: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IDisposablePack>('DisposablePack', disposablePackSchema);
