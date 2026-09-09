import mongoose, { Document, Schema } from 'mongoose';

export interface IFailedRecipient {
  email: string;
  error: string;
}

export interface INewsletterCampaign extends Document {
  subject: string;
  preheader?: string;
  body: string;
  status: 'draft' | 'sent';
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  failedRecipients: IFailedRecipient[];
  createdBy?: mongoose.Types.ObjectId;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const failedRecipientSchema = new Schema<IFailedRecipient>(
  {
    email: { type: String, required: true },
    error: { type: String, default: '' },
  },
  { _id: false }
);

const newsletterCampaignSchema = new Schema<INewsletterCampaign>(
  {
    subject: { type: String, required: true, trim: true },
    preheader: { type: String, default: '', trim: true },
    body: { type: String, required: true, trim: true },
    status: { type: String, enum: ['draft', 'sent'], default: 'draft' },
    recipientsCount: { type: Number, default: 0, min: 0 },
    sentCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    failedRecipients: { type: [failedRecipientSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<INewsletterCampaign>('NewsletterCampaign', newsletterCampaignSchema);
