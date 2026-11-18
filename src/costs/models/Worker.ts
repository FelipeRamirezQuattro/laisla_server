import mongoose, { Document, Schema } from 'mongoose';

// Trabajador de nómina para el cálculo de la mano de obra directa (MOD). No es un usuario del
// sistema (User sirve para el acceso): aquí solo importan su tarifa y sus horas.
export interface IWorker extends Document {
  name: string;
  role?: string;
  hourlyRate: number;
  hoursPerDay: number;
  /** Días que trabaja al mes (30,4 = todos los días, como se calculaba antes). */
  daysPerMonth: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workerSchema = new Schema<IWorker>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, default: '', trim: true },
    hourlyRate: { type: Number, required: true, min: 0 },
    hoursPerDay: { type: Number, default: 8, min: 0.1, max: 24 },
    daysPerMonth: { type: Number, default: 30.4, min: 0.1, max: 31 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

workerSchema.index({ active: 1, name: 1 });

export default mongoose.model<IWorker>('Worker', workerSchema);
