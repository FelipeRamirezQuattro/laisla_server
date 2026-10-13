import mongoose, { Document, Schema } from 'mongoose';

// Signed correction applied to one account's computed balance. Used for two things:
// calibrating a balance to a counted value (kind ADJUSTMENT), and moving money between
// accounts (kind TRANSFER, two rows sharing a groupId). 'general' is the cash held
// outside the till drawer; the other accounts are the non-cash payment methods.
export type AdjustableAccount = 'general' | 'transfer' | 'nequi' | 'card';

export interface ICashAccountAdjustment extends Document {
  account: AdjustableAccount;
  amount: number;
  kind: 'ADJUSTMENT' | 'TRANSFER';
  reason: string;
  groupId?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const cashAccountAdjustmentSchema = new Schema<ICashAccountAdjustment>(
  {
    account: { type: String, enum: ['general', 'transfer', 'nequi', 'card'], required: true },
    amount: { type: Number, required: true },
    kind: { type: String, enum: ['ADJUSTMENT', 'TRANSFER'], required: true },
    reason: { type: String, required: true, trim: true },
    groupId: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

cashAccountAdjustmentSchema.index({ account: 1 });

export default mongoose.model<ICashAccountAdjustment>('CashAccountAdjustment', cashAccountAdjustmentSchema);
