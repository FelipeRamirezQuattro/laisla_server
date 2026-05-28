import mongoose, { Document, Schema } from 'mongoose';

export interface IProvider extends Document {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  category: string;
  notes?: string;
  createdAt: Date;
}

const providerSchema = new Schema<IProvider>(
  {
    name: { type: String, required: true, trim: true },
    contactName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, lowercase: true, trim: true, default: '' },
    category: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model<IProvider>('Provider', providerSchema);
