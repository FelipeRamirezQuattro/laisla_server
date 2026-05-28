import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  category: 'coffee' | 'food' | 'beverage' | 'experience' | 'work-cafe' | 'other';
  stock: number;
  isActive: boolean;
  imageUrl?: string;
  recipeId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['coffee', 'food', 'beverage', 'experience', 'work-cafe', 'other'],
      required: true,
    },
    stock: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    imageUrl: { type: String, default: '' },
    recipeId: { type: Schema.Types.ObjectId, ref: 'Recipe', default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IProduct>('Product', productSchema);
