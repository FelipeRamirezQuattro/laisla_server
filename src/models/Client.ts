import mongoose, { Document, Schema } from 'mongoose';

export interface IClientFiscal {
  // TODO(provider-docs): confirm the exact accepted document-type set.
  docType?: 'CC' | 'NIT' | 'CE';
  docNumber?: string;
  dv?: string;
  businessName?: string; // razón social, when the client is JURIDICA
  personType?: 'NATURAL' | 'JURIDICA';
  fiscalEmail?: string; // may differ from Client.email
}

export interface IClient extends Document {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  visitCount: number;
  fiscal?: IClientFiscal;
  createdAt: Date;
}

const clientFiscalSchema = new Schema<IClientFiscal>(
  {
    docType: { type: String, enum: ['CC', 'NIT', 'CE'], default: null },
    docNumber: { type: String, default: '' },
    dv: { type: String, default: '' },
    businessName: { type: String, default: '' },
    personType: { type: String, enum: ['NATURAL', 'JURIDICA'], default: 'NATURAL' },
    fiscalEmail: { type: String, default: '' },
  },
  { _id: false }
);

const clientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    notes: { type: String, default: '' },
    visitCount: { type: Number, default: 0 },
    fiscal: { type: clientFiscalSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model<IClient>('Client', clientSchema);
