import mongoose, { Document, Schema } from 'mongoose';

export interface IClient extends Document {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  visitCount: number;
  createdAt: Date;
}

const clientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    notes: { type: String, default: '' },
    visitCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IClient>('Client', clientSchema);
