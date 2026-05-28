import mongoose, { Document, Schema } from 'mongoose';
import { MEASUREMENT_UNITS, MeasurementUnit, normalizeMeasurementUnit } from '../../utils/measurementUnits';

export interface IInsumo extends Document {
  nombre: string;
  categoriaId: mongoose.Types.ObjectId;
  unidad: MeasurementUnit;
  cantidadPresentacion: number;
  precioLista?: number;
  proveedorPrincipalId?: mongoose.Types.ObjectId;
  proveedorIds: mongoose.Types.ObjectId[];
  nivelBueno?: string;
  nivelRegular?: string;
  nivelAgotado?: string;
  activo: boolean;
  orden: number;
}

const insumoSchema = new Schema<IInsumo>(
  {
    nombre: { type: String, required: true, trim: true },
    categoriaId: { type: Schema.Types.ObjectId, ref: 'InsumoCategoria', required: true },
    unidad: { type: String, enum: MEASUREMENT_UNITS, default: 'UND', trim: true },
    cantidadPresentacion: { type: Number, default: 1, min: 0.001 },
    precioLista: { type: Number, default: null },
    proveedorPrincipalId: { type: Schema.Types.ObjectId, ref: 'Provider', default: null },
    proveedorIds: [{ type: Schema.Types.ObjectId, ref: 'Provider' }],
    nivelBueno: { type: String, default: null },
    nivelRegular: { type: String, default: null },
    nivelAgotado: { type: String, default: null },
    activo: { type: Boolean, default: true },
    orden: { type: Number, required: true },
  },
  { timestamps: true }
);

insumoSchema.index({ categoriaId: 1, orden: 1 });

insumoSchema.pre('validate', function (next) {
  this.unidad = normalizeMeasurementUnit(this.unidad);
  next();
});

export default mongoose.model<IInsumo>('Insumo', insumoSchema);
