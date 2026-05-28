import mongoose, { Document, Schema } from 'mongoose';

export interface IMonthProjection {
  month: number;
  isManualOverride: boolean;
  dailyTickets: number;
  monthlyTickets: number;
  averageTicket: number;
  dailySales: number;
  monthlySales: number;
  costOfSalesPct: number;
  costOfSales: number;
  operatingExpenses: number;
  totalExpenses: number;
  profit: number;
}

export interface IProjection extends Document {
  year: number;
  growthRate: number;
  workingDaysPerMonth: number;
  months: IMonthProjection[];
  createdAt: Date;
  updatedAt: Date;
}

const monthProjectionSchema = new Schema<IMonthProjection>(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    isManualOverride: { type: Boolean, default: false },
    dailyTickets: { type: Number, default: 0, min: 0 },
    monthlyTickets: { type: Number, default: 0 },
    averageTicket: { type: Number, default: 0, min: 0 },
    dailySales: { type: Number, default: 0 },
    monthlySales: { type: Number, default: 0 },
    costOfSalesPct: { type: Number, default: 0.25, min: 0, max: 1 },
    costOfSales: { type: Number, default: 0 },
    operatingExpenses: { type: Number, default: 0, min: 0 },
    totalExpenses: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
  },
  { _id: false }
);

const projectionSchema = new Schema<IProjection>(
  {
    year: { type: Number, required: true, unique: true },
    growthRate: { type: Number, default: 0.05, min: 0 },
    workingDaysPerMonth: { type: Number, default: 26, min: 1 },
    months: {
      type: [monthProjectionSchema],
      default: () =>
        Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          isManualOverride: false,
          dailyTickets: 0,
          monthlyTickets: 0,
          averageTicket: 0,
          dailySales: 0,
          monthlySales: 0,
          costOfSalesPct: 0.25,
          costOfSales: 0,
          operatingExpenses: 0,
          totalExpenses: 0,
          profit: 0,
        })),
    },
  },
  { timestamps: true }
);

export default mongoose.model<IProjection>('Projection', projectionSchema);
