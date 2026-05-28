import mongoose, { Document, Schema } from 'mongoose';

export interface IExpenses {
  payroll: number;
  founderPayroll: number;
  rent: number;
  bankFees: number;
  utilities: number;
  maintenance: number;
  marketing: number;
  paidAds: number;
  musicRights: number;
  accounting: number;
  other: number;
}

export interface IActualResult extends Document {
  year: number;
  month: number;
  totalSales: number;
  costOfSales: number;
  costOfSalesPct: number;
  grossMargin: number;
  grossMarginPct: number;
  expenses: IExpenses;
  totalOperatingExpenses: number;
  netProfit: number;
  netProfitPct: number;
  variationVsPrevMonth: Record<string, number>;
  insights: string[];
  createdAt: Date;
  updatedAt: Date;
}

const expensesSchema = new Schema<IExpenses>(
  {
    payroll: { type: Number, default: 0 },
    founderPayroll: { type: Number, default: 0 },
    rent: { type: Number, default: 0 },
    bankFees: { type: Number, default: 0 },
    utilities: { type: Number, default: 0 },
    maintenance: { type: Number, default: 0 },
    marketing: { type: Number, default: 0 },
    paidAds: { type: Number, default: 0 },
    musicRights: { type: Number, default: 0 },
    accounting: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  { _id: false }
);

const actualResultSchema = new Schema<IActualResult>(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    totalSales: { type: Number, default: 0, min: 0 },
    costOfSales: { type: Number, default: 0, min: 0 },
    costOfSalesPct: { type: Number, default: 0 },
    grossMargin: { type: Number, default: 0 },
    grossMarginPct: { type: Number, default: 0 },
    expenses: { type: expensesSchema, default: () => ({}) },
    totalOperatingExpenses: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    netProfitPct: { type: Number, default: 0 },
    variationVsPrevMonth: { type: Schema.Types.Mixed, default: {} },
    insights: [{ type: String }],
  },
  { timestamps: true }
);

actualResultSchema.index({ year: 1, month: 1 }, { unique: true });

export default mongoose.model<IActualResult>('ActualResult', actualResultSchema);
