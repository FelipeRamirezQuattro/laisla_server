import mongoose, { Document, Schema } from 'mongoose';

export type CostHistoryEntityType = 'RAW_MATERIAL' | 'RECIPE' | 'PARAMS' | 'DISPOSABLE_PACK';

export interface ICostHistory extends Document {
  entityType: CostHistoryEntityType;
  entityId: mongoose.Types.ObjectId;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
}

const costHistorySchema = new Schema<ICostHistory>(
  {
    entityType: {
      type: String,
      enum: ['RAW_MATERIAL', 'RECIPE', 'PARAMS', 'DISPOSABLE_PACK'],
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true },
    field: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

costHistorySchema.index({ entityId: 1, changedAt: -1 });

export default mongoose.model<ICostHistory>('CostHistory', costHistorySchema);
