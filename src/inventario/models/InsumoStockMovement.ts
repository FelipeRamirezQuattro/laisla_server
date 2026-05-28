import mongoose, { Document, Schema } from 'mongoose';
import { MEASUREMENT_UNITS, MeasurementUnit } from '../../utils/measurementUnits';

export type StockMovementTipo =
  | 'VENTA_AUTOMATICA'
  | 'COMPRA'
  | 'AJUSTE_MANUAL'
  | 'REVISION_MANUAL';

export type StockMovementEstado = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface IInsumoStockMovement extends Document {
  insumoId: mongoose.Types.ObjectId;
  tipo: StockMovementTipo;
  estado: StockMovementEstado;
  cantidad: number;
  unidad: MeasurementUnit;
  cantidadBase: number;
  fecha: Date;
  orderId?: mongoose.Types.ObjectId;
  revisionId?: mongoose.Types.ObjectId;
  providerId?: mongoose.Types.ObjectId;
  notas?: string;
  creadoPor?: mongoose.Types.ObjectId;
  aprobadoPor?: mongoose.Types.ObjectId;
  aprobadoEn?: Date;
  rechazadoPor?: mongoose.Types.ObjectId;
  rechazadoEn?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stockMovementSchema = new Schema<IInsumoStockMovement>(
  {
    insumoId: { type: Schema.Types.ObjectId, ref: 'Insumo', required: true, index: true },
    tipo: {
      type: String,
      enum: ['VENTA_AUTOMATICA', 'COMPRA', 'AJUSTE_MANUAL', 'REVISION_MANUAL'],
      required: true,
    },
    estado: { type: String, enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO'], default: 'PENDIENTE', index: true },
    cantidad: { type: Number, required: true, min: 0 },
    unidad: { type: String, enum: MEASUREMENT_UNITS, required: true },
    cantidadBase: { type: Number, required: true },
    fecha: { type: Date, default: () => new Date(), index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    revisionId: { type: Schema.Types.ObjectId, ref: 'RevisionInventario', default: null },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', default: null },
    notas: { type: String, default: '' },
    creadoPor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    aprobadoPor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    aprobadoEn: { type: Date, default: null },
    rechazadoPor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rechazadoEn: { type: Date, default: null },
  },
  { timestamps: true }
);

stockMovementSchema.index({ insumoId: 1, fecha: -1 });
stockMovementSchema.index({ orderId: 1, tipo: 1 }, { sparse: true });

export default mongoose.model<IInsumoStockMovement>('InsumoStockMovement', stockMovementSchema);
