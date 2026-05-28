import mongoose, { Document, Schema } from 'mongoose';

export const DEFAULT_TABLE_ZONES = [
  { value: 'social', label: 'Social', orden: 1 },
  { value: 'work-cafe', label: 'Work Café', orden: 2 },
  { value: 'experience', label: 'Experiencias', orden: 3 },
  { value: 'terrace', label: 'Terraza', orden: 4 },
];

export interface ITableZone extends Document {
  value: string;
  label: string;
  orden: number;
}

const tableZoneSchema = new Schema<ITableZone>(
  {
    value: { type: String, required: true, trim: true, lowercase: true, unique: true },
    label: { type: String, required: true, trim: true },
    orden: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ITableZone>('TableZone', tableZoneSchema);
