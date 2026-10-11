import mongoose, { Document, Schema } from 'mongoose';

// Cash physically added to or removed from the till that is NOT a purchase
// (sangría to the safe/bank, or topping up change) — purchases paid from the
// till still go through DailyExpense, unchanged.
export type CashMovementType = 'WITHDRAWAL' | 'CASH_IN';

export interface ICashMovement extends Document {
  // null when the movement is made outside a shift (e.g. topping up / emptying the till on a closed day)
  cashShiftId: mongoose.Types.ObjectId | null;
  type: CashMovementType;
  amount: number;
  reason: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const cashMovementSchema = new Schema<ICashMovement>(
  {
    cashShiftId: { type: Schema.Types.ObjectId, ref: 'CashShift', default: null },
    type: { type: String, enum: ['WITHDRAWAL', 'CASH_IN'], required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

cashMovementSchema.index({ cashShiftId: 1, createdAt: 1 });

export default mongoose.model<ICashMovement>('CashMovement', cashMovementSchema);
