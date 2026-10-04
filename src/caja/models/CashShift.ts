import mongoose, { Document, Schema } from 'mongoose';

export type CashShiftStatus = 'OPEN' | 'COUNTING' | 'CLOSED' | 'REVIEWED';

export interface IDenominationCount {
  value: number;
  kind: 'bill' | 'coin';
  quantity: number;
  subtotal: number;
}

export interface ICashCount {
  denominations: IDenominationCount[];
  total: number;
  countedBy: mongoose.Types.ObjectId;
  countedAt: Date;
}

export type CashShiftAuditAction =
  | 'OPEN'
  | 'COUNT_OPENING'
  | 'COUNT_CLOSING'
  | 'CLOSE'
  | 'APPROVE'
  | 'ADJUSTMENT';

export interface ICashShiftAuditEntry {
  action: CashShiftAuditAction;
  by: mongoose.Types.ObjectId;
  at: Date;
  detail?: Record<string, unknown>;
}

export interface ICashShiftSalesSnapshot {
  cashSales: number;
  cardSales: number;
  nequiSales: number;
  transferSales: number;
  totalSales: number;
  totalOrders: number;
  unassignedOrdersCount: number;
}

export interface ICashShift extends Document {
  status: CashShiftStatus;
  openedBy: mongoose.Types.ObjectId;
  openedAt: Date;
  openingFloat: ICashCount;

  closingCount?: ICashCount;
  closedBy?: mongoose.Types.ObjectId;
  closedAt?: Date;

  salesSnapshot?: ICashShiftSalesSnapshot;
  totalExpenses?: number;
  totalWithdrawals?: number;
  totalCashIn?: number;
  expectedCash?: number;
  difference?: number;

  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;

  fiscalWarning?: string;
  notes?: string;
  auditLog: ICashShiftAuditEntry[];

  migratedFromLegacy?: boolean;
  legacySourceId?: mongoose.Types.ObjectId;
  legacyManualExpenses?: { description: string; amount: number }[];

  createdAt: Date;
  updatedAt: Date;
}

const denominationCountSchema = new Schema<IDenominationCount>(
  {
    value: { type: Number, required: true },
    kind: { type: String, enum: ['bill', 'coin'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const cashCountSchema = new Schema<ICashCount>(
  {
    denominations: { type: [denominationCountSchema], default: [] },
    total: { type: Number, required: true, min: 0 },
    countedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    countedAt: { type: Date, required: true },
  },
  { _id: false }
);

const auditEntrySchema = new Schema<ICashShiftAuditEntry>(
  {
    action: {
      type: String,
      enum: ['OPEN', 'COUNT_OPENING', 'COUNT_CLOSING', 'CLOSE', 'APPROVE', 'ADJUSTMENT'],
      required: true,
    },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true },
    detail: { type: Schema.Types.Mixed, default: undefined },
  },
  { _id: false }
);

const salesSnapshotSchema = new Schema<ICashShiftSalesSnapshot>(
  {
    cashSales: { type: Number, default: 0 },
    cardSales: { type: Number, default: 0 },
    nequiSales: { type: Number, default: 0 },
    transferSales: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    unassignedOrdersCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const cashShiftSchema = new Schema<ICashShift>(
  {
    status: { type: String, enum: ['OPEN', 'COUNTING', 'CLOSED', 'REVIEWED'], required: true, default: 'OPEN' },
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    openedAt: { type: Date, required: true },
    openingFloat: { type: cashCountSchema, required: true },

    closingCount: { type: cashCountSchema, default: undefined },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },

    salesSnapshot: { type: salesSnapshotSchema, default: undefined },
    totalExpenses: { type: Number, default: 0 },
    totalWithdrawals: { type: Number, default: 0 },
    totalCashIn: { type: Number, default: 0 },
    expectedCash: { type: Number, default: null },
    difference: { type: Number, default: null },

    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: '' },

    fiscalWarning: { type: String, default: '' },
    notes: { type: String, default: '' },
    auditLog: { type: [auditEntrySchema], default: [] },

    migratedFromLegacy: { type: Boolean, default: false },
    legacySourceId: { type: Schema.Types.ObjectId, ref: 'CashClosing', default: null },
    legacyManualExpenses: {
      type: [
        new Schema(
          { description: { type: String, required: true }, amount: { type: Number, required: true } },
          { _id: false }
        ),
      ],
      default: undefined,
    },
  },
  { timestamps: true }
);

// Invariant: only one OPEN shift system-wide (single physical register).
cashShiftSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'OPEN' } }
);
cashShiftSchema.index({ status: 1, closedAt: -1 });
cashShiftSchema.index({ openedBy: 1, openedAt: -1 });

export default mongoose.model<ICashShift>('CashShift', cashShiftSchema);
