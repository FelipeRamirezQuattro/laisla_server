import mongoose, { Document, Schema } from 'mongoose';

export interface IPrintAgent extends Document {
  name: string;
  tokenHash: string;
  isActive: boolean;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const printAgentSchema = new Schema<IPrintAgent>(
  {
    name: { type: String, required: true, trim: true },
    tokenHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IPrintAgent>('PrintAgent', printAgentSchema);
