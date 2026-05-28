import mongoose, { Document, Schema } from 'mongoose';
import { MEASUREMENT_UNITS, MeasurementUnit } from '../utils/measurementUnits';

export type DailyExpenseType = 'INSUMO' | 'OTRO';

export interface IDailyExpense extends Document {
  date: Date;
  type: DailyExpenseType;
  description: string;
  amount: number;
  insumoId?: mongoose.Types.ObjectId;
  providerId?: mongoose.Types.ObjectId;
  quantity?: number;
  unit?: MeasurementUnit;
  stockMovementId?: mongoose.Types.ObjectId;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dailyExpenseSchema = new Schema<IDailyExpense>(
  {
    date: { type: Date, required: true },
    type: { type: String, enum: ['INSUMO', 'OTRO'], required: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    insumoId: { type: Schema.Types.ObjectId, ref: 'Insumo', default: null },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', default: null },
    quantity: { type: Number, default: null, min: 0 },
    unit: { type: String, enum: MEASUREMENT_UNITS, default: null },
    stockMovementId: { type: Schema.Types.ObjectId, ref: 'InsumoStockMovement', default: null },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

dailyExpenseSchema.index({ date: -1, type: 1 });
dailyExpenseSchema.index({ insumoId: 1, date: -1 });

export default mongoose.model<IDailyExpense>('DailyExpense', dailyExpenseSchema);
