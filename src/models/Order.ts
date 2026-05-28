import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: number;
  productType?: 'product' | 'recipe';
  variantSize?: string;
  taxType?: 'NONE' | 'IVA_19' | 'CONSUMO_8';
  taxRate?: number;
  taxAmount?: number;
}

export interface IOrderStatusHistory {
  status: 'pending' | 'in-progress' | 'ready' | 'delivered' | 'billed' | 'cancelled';
  at: Date;
  by?: mongoose.Types.ObjectId;
  notes?: string;
}

export interface IOrder extends Document {
  tableId?: mongoose.Types.ObjectId;
  orderType: 'table' | 'walk-in';
  clientId?: mongoose.Types.ObjectId;
  items: IOrderItem[];
  status: 'pending' | 'in-progress' | 'ready' | 'delivered' | 'billed' | 'cancelled';
  subtotal: number;
  total: number;
  paymentMethod?: 'cash' | 'card' | 'transfer';
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  serviceDate: Date;
  deliveredAt?: Date;
  billedAt?: Date;
  closedAt?: Date;
  inventoryDeductedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  cancelReasonDetail?: string;
  statusHistory: IOrderStatusHistory[];
  createdAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    productType: { type: String, enum: ['product', 'recipe'], default: 'product' },
    variantSize: { type: String, default: '' },
    taxType: { type: String, enum: ['NONE', 'IVA_19', 'CONSUMO_8'], default: 'NONE' },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new Schema<IOrderStatusHistory>(
  {
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'ready', 'delivered', 'billed', 'cancelled'],
      required: true,
    },
    at: { type: Date, default: () => new Date() },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    tableId: { type: Schema.Types.ObjectId, ref: 'Table', default: null },
    orderType: { type: String, enum: ['table', 'walk-in'], default: 'table' },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'ready', 'delivered', 'billed', 'cancelled'],
      default: 'pending',
    },
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['cash', 'card', 'transfer'], default: null },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    serviceDate: { type: Date, default: () => new Date() },
    deliveredAt: { type: Date, default: null },
    billedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    inventoryDeductedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    cancelReasonDetail: { type: String, default: '' },
    statusHistory: [statusHistorySchema],
  },
  { timestamps: true }
);

export default mongoose.model<IOrder>('Order', orderSchema);
