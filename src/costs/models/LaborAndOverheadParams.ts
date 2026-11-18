import mongoose, { Document, Schema } from 'mongoose';

export interface IOverheadItem {
  concept: string;
  monthlyCost: number;
}

export interface ILaborAndOverheadParams extends Document {
  hourlyWage: number;
  numberOfWorkers: number;
  hoursPerDay: number;
  numberOfShifts: number;
  monthlyCustomers: number;
  productsPerCustomer: number;
  totalHourlyWage: number;
  dailyLabor: number;
  monthlyLabor: number;
  laborPerItem: number;
  overheadItems: IOverheadItem[];
  totalMonthlyOverhead: number;
  dailyOverhead: number;
  overheadPerItem: number;
  ivaRate: number;
  /** Mes ('yyyy-MM') cuyos datos de ventas y gastos se usaron la última vez que se aplicó la sugerencia. */
  baselineMonth?: string | null;
  updatedAt: Date;
}

const overheadItemSchema = new Schema<IOverheadItem>(
  {
    concept: { type: String, required: true },
    monthlyCost: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const laborAndOverheadParamsSchema = new Schema<ILaborAndOverheadParams>(
  {
    hourlyWage: { type: Number, default: 0, min: 0 },
    numberOfWorkers: { type: Number, default: 1, min: 1 },
    hoursPerDay: { type: Number, default: 8, min: 1 },
    numberOfShifts: { type: Number, default: 1, min: 1 },
    monthlyCustomers: { type: Number, default: 1, min: 1 },
    productsPerCustomer: { type: Number, default: 1, min: 1 },
    totalHourlyWage: { type: Number, default: 0 },
    dailyLabor: { type: Number, default: 0 },
    monthlyLabor: { type: Number, default: 0 },
    laborPerItem: { type: Number, default: 0 },
    overheadItems: [overheadItemSchema],
    totalMonthlyOverhead: { type: Number, default: 0 },
    dailyOverhead: { type: Number, default: 0 },
    overheadPerItem: { type: Number, default: 0 },
    ivaRate: { type: Number, default: 0.19, min: 0, max: 1 },
    baselineMonth: { type: String, default: null, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  },
  { timestamps: true }
);

export default mongoose.model<ILaborAndOverheadParams>(
  'LaborAndOverheadParams',
  laborAndOverheadParamsSchema
);
