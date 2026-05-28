import mongoose, { Document, Schema } from 'mongoose';

export interface IExpense {
  description: string;
  amount: number;
  source?: 'manual' | 'daily_expense';
  expenseId?: mongoose.Types.ObjectId;
}

export interface ICashClosing extends Document {
  date: Date;
  openingCash: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  expenses: IExpense[];
  totalExpenses: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  notes?: string;
  closedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    source: { type: String, enum: ['manual', 'daily_expense'], default: 'manual' },
    expenseId: { type: Schema.Types.ObjectId, ref: 'DailyExpense', default: null },
  },
  { _id: false }
);

const cashClosingSchema = new Schema<ICashClosing>(
  {
    date: { type: Date, required: true },
    openingCash: { type: Number, required: true, default: 0 },
    cashSales: { type: Number, default: 0 },
    cardSales: { type: Number, default: 0 },
    transferSales: { type: Number, default: 0 },
    expenses: [expenseSchema],
    totalExpenses: { type: Number, default: 0 },
    expectedCash: { type: Number, default: 0 },
    actualCash: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ICashClosing>('CashClosing', cashClosingSchema);
