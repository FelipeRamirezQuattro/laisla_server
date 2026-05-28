import mongoose, { Document, Schema } from 'mongoose';

export interface IGeneratedGroup {
  groupNumber: number;
  guests: mongoose.Types.ObjectId[];
}

export interface IEvent extends Document {
  title: string;
  description: string;
  type: 'picnic' | 'movie' | 'trivia' | 'tasting' | 'dinner-with-strangers' | 'other';
  date: Date;
  time: string;
  pricePerPerson: number;
  maxCapacity: number;
  currentRegistrations: number;
  imageUrl?: string;
  isPublished: boolean;
  status: 'upcoming' | 'active' | 'cancelled' | 'completed';
  generatedGroups: IGeneratedGroup[];
  createdAt: Date;
}

const generatedGroupSchema = new Schema<IGeneratedGroup>(
  {
    groupNumber: { type: Number, required: true },
    guests: [{ type: Schema.Types.ObjectId, ref: 'DinnerGuest' }],
  },
  { _id: false }
);

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['picnic', 'movie', 'trivia', 'tasting', 'dinner-with-strangers', 'other'],
      required: true,
    },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    pricePerPerson: { type: Number, required: true, min: 0 },
    maxCapacity: { type: Number, required: true, min: 1 },
    currentRegistrations: { type: Number, default: 0 },
    imageUrl: { type: String, default: '' },
    isPublished: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['upcoming', 'active', 'cancelled', 'completed'],
      default: 'upcoming',
    },
    generatedGroups: [generatedGroupSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IEvent>('Event', eventSchema);
