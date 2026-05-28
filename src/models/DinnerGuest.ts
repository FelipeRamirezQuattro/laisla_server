import mongoose, { Document, Schema } from 'mongoose';
import { CompatibilityProfile } from '../types';

export interface IDinnerGuest extends Document {
  eventId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  ageRange: '18-24' | '25-32' | '33-40' | '41-50' | '50+';
  compatibilityProfile: CompatibilityProfile;
  assignedGroup?: number;
  status: 'registered' | 'confirmed' | 'cancelled';
  createdAt: Date;
}

const compatibilityProfileSchema = new Schema(
  {
    socialEnergy: { type: Number, required: true, min: 1, max: 5 },
    conversationType: {
      type: String,
      enum: ['deep', 'intellectual', 'creative', 'entrepreneurial', 'casual', 'balanced'],
      required: true,
    },
    workAttitude: { type: Number, required: true, min: 1, max: 5 },
    hobbies: [{ type: String }],
    spontaneity: { type: Number, required: true, min: 1, max: 5 },
    dinnerStyle: { type: String, enum: ['intimate', 'lively', 'experiential'], required: true },
    personalityTag: {
      type: String,
      enum: ['intellectual', 'empathetic', 'aesthetic', 'adventurous'],
      required: true,
    },
  },
  { _id: false }
);

const dinnerGuestSchema = new Schema<IDinnerGuest>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    ageRange: {
      type: String,
      enum: ['18-24', '25-32', '33-40', '41-50', '50+'],
      required: true,
    },
    compatibilityProfile: { type: compatibilityProfileSchema, required: true },
    assignedGroup: { type: Number, default: null },
    status: { type: String, enum: ['registered', 'confirmed', 'cancelled'], default: 'registered' },
  },
  { timestamps: true }
);

export default mongoose.model<IDinnerGuest>('DinnerGuest', dinnerGuestSchema);
