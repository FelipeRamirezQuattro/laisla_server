import mongoose, { Document, Schema } from 'mongoose';

export interface INewsletterCampaign extends Document {
  subject: string;
  preheader?: string;
  body: string;
  status: 'draft' | 'sent';
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  createdBy?: mongoose.Types.ObjectId;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const newsletterCampaignSchema = new Schema<INewsletterCampaign>(
  {
    subject: { type: String, required: true, trim: true },
    preheader: { type: String, default: '', trim: true },
    body: { type: String, required: true, trim: true },
    status: { type: String, enum: ['draft', 'sent'], default: 'draft' },
    recipientsCount: { type: Number, default: 0, min: 0 },
    sentCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<INewsletterCampaign>('NewsletterCampaign', newsletterCampaignSchema);
