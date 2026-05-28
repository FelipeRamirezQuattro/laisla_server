import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryMovement extends Document {
  rawMaterialId: mongoose.Types.ObjectId;
  period: Date;
  weekNumber: number;
  openingStock: number;
  purchases: number;
  consumed: number;
  closingStock: number;
  unit: 'KG' | 'GR' | 'LT' | 'ML' | 'UND' | 'PAQ';
  createdAt: Date;
}

const inventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    rawMaterialId: { type: Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    period: { type: Date, required: true },
    weekNumber: { type: Number, required: true, min: 1, max: 53 },
    openingStock: { type: Number, default: 0, min: 0 },
    purchases: { type: Number, default: 0, min: 0 },
    consumed: { type: Number, default: 0, min: 0 },
    closingStock: { type: Number, default: 0 },
    unit: { type: String, enum: ['KG', 'GR', 'LT', 'ML', 'UND', 'PAQ'], required: true },
  },
  { timestamps: true }
);

inventoryMovementSchema.pre('save', function (next) {
  this.closingStock = this.openingStock + this.purchases - this.consumed;
  next();
});

inventoryMovementSchema.index({ rawMaterialId: 1, period: -1 });

export default mongoose.model<IInventoryMovement>('InventoryMovement', inventoryMovementSchema);
