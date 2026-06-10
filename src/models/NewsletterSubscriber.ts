import mongoose, { Document, Schema } from 'mongoose';

export interface INewsletterSubscriber extends Document {
  email: string;
  name?: string;
  status: 'active' | 'unsubscribed';
  source: 'homepage' | 'admin';
  subscribedAt: Date;
  unsubscribedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const newsletterSubscriberSchema = new Schema<INewsletterSubscriber>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    name: { type: String, default: '', trim: true },
    status: { type: String, enum: ['active', 'unsubscribed'], default: 'active' },
    source: { type: String, enum: ['homepage', 'admin'], default: 'homepage' },
    subscribedAt: { type: Date, default: Date.now },
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<INewsletterSubscriber>('NewsletterSubscriber', newsletterSubscriberSchema);
