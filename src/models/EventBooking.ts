import mongoose, { Document, Schema } from 'mongoose';

export interface IEventBooking extends Document {
  eventId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  tickets: number;
  notes?: string;
  status: 'registered' | 'confirmed' | 'cancelled';
  createdAt: Date;
}

const eventBookingSchema = new Schema<IEventBooking>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    tickets: { type: Number, required: true, min: 1 },
    notes: { type: String, default: '', trim: true },
    status: { type: String, enum: ['registered', 'confirmed', 'cancelled'], default: 'registered' },
  },
  { timestamps: true }
);

export default mongoose.model<IEventBooking>('EventBooking', eventBookingSchema);
