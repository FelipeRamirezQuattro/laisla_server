import mongoose, { Document, Schema } from 'mongoose';

export interface IInsumoCategoria extends Document {
  nombre: string;
  orden: number;
}

const insumoCategoriaSchema = new Schema<IInsumoCategoria>(
  {
    nombre: { type: String, required: true, trim: true },
    orden: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IInsumoCategoria>('InsumoCategoria', insumoCategoriaSchema);
