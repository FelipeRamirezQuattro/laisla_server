import mongoose, { Document, Schema } from 'mongoose';

export type PrinterRole = 'CAJA' | 'BARRA';

export interface IPrinter extends Document {
  name: string;
  role: PrinterRole;
  ip: string;
  port: number;
  paperWidthMm: number;
  columns: number;
  hasCashDrawer: boolean;
  isActive: boolean;
  agentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const printerSchema = new Schema<IPrinter>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['CAJA', 'BARRA'], required: true },
    ip: { type: String, required: true, trim: true },
    port: { type: Number, default: 9100 },
    paperWidthMm: { type: Number, default: 80 },
    columns: { type: Number, default: 48 },
    hasCashDrawer: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'PrintAgent', default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IPrinter>('Printer', printerSchema);
