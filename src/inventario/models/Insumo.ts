import mongoose, { Document, Schema } from 'mongoose';
import { MEASUREMENT_UNITS, MeasurementUnit, normalizeMeasurementUnit } from '../../utils/measurementUnits';

// NINGUNO: no vence. FECHA: cada compra trae su fecha de vencimiento (p. ej. leche).
// VIDA_UTIL: vence N días después de la compra (p. ej. aguacate).
export const TIPOS_VENCIMIENTO = ['NINGUNO', 'FECHA', 'VIDA_UTIL'] as const;
export type TipoVencimiento = (typeof TIPOS_VENCIMIENTO)[number];

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
  // En la unidad del insumo. Por debajo de este stock se alerta a todos los usuarios.
  stockMinimo?: number | null;
  tipoVencimiento: TipoVencimiento;
  vidaUtilDias?: number | null;
  // Control anti-repetición de alertas (ver StockAlertService).
  alertaStockBajoActiva?: boolean;
  ultimaAlertaConsumoAt?: Date | null;
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
    stockMinimo: { type: Number, default: null, min: 0 },
    tipoVencimiento: { type: String, enum: TIPOS_VENCIMIENTO, default: 'NINGUNO' },
    vidaUtilDias: { type: Number, default: null, min: 1 },
    alertaStockBajoActiva: { type: Boolean, default: false },
    ultimaAlertaConsumoAt: { type: Date, default: null },
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
