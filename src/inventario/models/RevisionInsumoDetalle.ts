import mongoose, { Document, Schema } from 'mongoose';
import { MEASUREMENT_UNITS, MeasurementUnit } from '../../utils/measurementUnits';

export type NivelType = 'BUENO' | 'REGULAR' | 'AGOTADO' | 'NO_REVISADO';

export interface IRevisionInsumoDetalle extends Document {
  revisionId: mongoose.Types.ObjectId;
  insumoId: mongoose.Types.ObjectId;
  nombreSnapshot: string;
  nivel: NivelType;
  cantidadObservada?: number;
  unidadObservada?: MeasurementUnit;
  cantidadSistema?: number;
  unidadSistema?: MeasurementUnit;
  observacion?: string;
  compradoEn?: Date;
}

const detalleSchema = new Schema<IRevisionInsumoDetalle>(
  {
    revisionId: { type: Schema.Types.ObjectId, ref: 'RevisionInventario', required: true },
    insumoId: { type: Schema.Types.ObjectId, ref: 'Insumo', required: true },
    nombreSnapshot: { type: String, required: true },
    nivel: {
      type: String,
      enum: ['BUENO', 'REGULAR', 'AGOTADO', 'NO_REVISADO'],
      default: 'NO_REVISADO',
    },
    cantidadObservada: { type: Number, default: null },
    unidadObservada: { type: String, enum: MEASUREMENT_UNITS, default: null },
    cantidadSistema: { type: Number, default: null },
    unidadSistema: { type: String, enum: MEASUREMENT_UNITS, default: null },
    observacion: { type: String, default: '' },
    compradoEn: { type: Date, default: null },
  },
  { timestamps: true }
);

detalleSchema.index({ revisionId: 1 });
detalleSchema.index({ insumoId: 1, nivel: 1 });

export default mongoose.model<IRevisionInsumoDetalle>('RevisionInsumoDetalle', detalleSchema);
