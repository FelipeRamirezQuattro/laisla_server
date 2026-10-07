import mongoose, { Document, Schema } from 'mongoose';

export type PrinterRole = 'CAJA' | 'BARRA';
export type PrinterConnectionType = 'NETWORK' | 'USB';

export interface IPrinter extends Document {
  name: string;
  role: PrinterRole;
  connectionType: PrinterConnectionType;
  ip?: string;
  port: number;
  // Raw local port/device path for a USB-connected printer (e.g. \\.\COM3
  // on Windows) — only meaningful when connectionType is 'USB'.
  localPath?: string;
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
    connectionType: { type: String, enum: ['NETWORK', 'USB'], default: 'NETWORK' },
    ip: { type: String, trim: true, default: null },
    port: { type: Number, default: 9100 },
    localPath: { type: String, trim: true, default: null },
    paperWidthMm: { type: Number, default: 80 },
    columns: { type: Number, default: 48 },
    hasCashDrawer: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'PrintAgent', default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IPrinter>('Printer', printerSchema);
