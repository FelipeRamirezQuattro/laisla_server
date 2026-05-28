import mongoose, { Document, Schema } from 'mongoose';

export interface ITable extends Document {
  name: string;
  capacity: number;
  zone: string;
  status: 'available' | 'occupied' | 'reserved';
  currentOrderId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const tableSchema = new Schema<ITable>(
  {
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    zone: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved'],
      default: 'available',
    },
    currentOrderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true }
);

export default mongoose.model<ITable>('Table', tableSchema);
