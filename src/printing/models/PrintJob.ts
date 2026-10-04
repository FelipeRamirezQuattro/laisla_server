import mongoose, { Document, Schema } from 'mongoose';

export type PrintJobType = 'RECEIPT' | 'KITCHEN_ORDER' | 'REPRINT' | 'TEST';
export type PrintJobStatus = 'PENDING' | 'CLAIMED' | 'DONE' | 'FAILED';

export interface IPrintJob extends Document {
  type: PrintJobType;
  // Optional: a RECEIPT job created while there's no active CAJA printer is
  // still recorded as PENDING (so the admin alert can surface it), but has
  // nothing to claim it — see PrintJobService.createReceiptJobIfNeeded.
  printerId?: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  fiscalDocumentId?: mongoose.Types.ObjectId;
  payload: unknown;
  status: PrintJobStatus;
  attempts: number;
  claimedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const printJobSchema = new Schema<IPrintJob>(
  {
    type: { type: String, enum: ['RECEIPT', 'KITCHEN_ORDER', 'REPRINT', 'TEST'], required: true },
    printerId: { type: Schema.Types.ObjectId, ref: 'Printer', default: null },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    fiscalDocumentId: { type: Schema.Types.ObjectId, ref: 'FiscalDocument', default: null },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['PENDING', 'CLAIMED', 'DONE', 'FAILED'], default: 'PENDING' },
    attempts: { type: Number, default: 0 },
    claimedAt: { type: Date, default: null },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

printJobSchema.index({ status: 1, printerId: 1, createdAt: 1 });
// Guards against duplicate RECEIPT jobs for the same order — the fiscal
// worker poll and the fiscal webhook can both observe an ACCEPTED/CONTINGENCY
// transition for the same document and race to create the print job.
printJobSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { type: 'RECEIPT' } }
);

export default mongoose.model<IPrintJob>('PrintJob', printJobSchema);
