import mongoose, { Document, Schema } from 'mongoose';

export interface ISpecialOccasion {
  hasOccasion: boolean;
  type?: 'birthday' | 'anniversary' | 'business meeting' | 'first date' | 'celebration' | 'other';
  notes?: string;
}

export interface IReservation extends Document {
  clientName: string;
  email: string;
  phone: string;
  date: Date;
  timeSlot: string;
  partySize: number;
  tableId?: mongoose.Types.ObjectId;
  detail?: string;
  zone: 'social' | 'work-cafe' | 'terrace';
  specialOccasion: ISpecialOccasion;
  confirmationCode: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  createdAt: Date;
}

const specialOccasionSchema = new Schema<ISpecialOccasion>(
  {
    hasOccasion: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['birthday', 'anniversary', 'business meeting', 'first date', 'celebration', 'other'],
      default: null,
    },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const reservationSchema = new Schema<IReservation>(
  {
    clientName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    partySize: { type: Number, required: true, min: 1 },
    tableId: { type: Schema.Types.ObjectId, ref: 'Table', default: null },
    detail: { type: String, default: '' },
    zone: { type: String, enum: ['social', 'work-cafe', 'terrace'], required: true },
    specialOccasion: { type: specialOccasionSchema, default: () => ({ hasOccasion: false }) },
    confirmationCode: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

export default mongoose.model<IReservation>('Reservation', reservationSchema);
