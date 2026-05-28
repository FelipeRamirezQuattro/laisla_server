import mongoose, { Document, Schema } from 'mongoose';

export type TurnoType = 'MATUTINO' | 'VESPERTINO';

export interface IReapertura {
  adminId: mongoose.Types.ObjectId;
  reabiertaEn: Date;
  motivo?: string;
}

export interface IRevisionInventario extends Document {
  fecha: Date;
  turno: TurnoType;
  colaboradorId: mongoose.Types.ObjectId;
  creadaEn: Date;
  cerradaEn?: Date;
  notas?: string;
  reaperturas: IReapertura[];
}

const revisionSchema = new Schema<IRevisionInventario>(
  {
    fecha: { type: Date, required: true },
    turno: { type: String, enum: ['MATUTINO', 'VESPERTINO'], required: true },
    colaboradorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    creadaEn: { type: Date, default: () => new Date() },
    cerradaEn: { type: Date, default: null },
    notas: { type: String, default: '' },
    reaperturas: [
      {
        adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reabiertaEn: { type: Date, default: () => new Date() },
        motivo: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

revisionSchema.index({ fecha: 1, turno: 1, colaboradorId: 1 }, { unique: true });

export default mongoose.model<IRevisionInventario>('RevisionInventario', revisionSchema);
