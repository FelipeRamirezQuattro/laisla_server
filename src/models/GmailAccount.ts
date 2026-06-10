import mongoose, { Document, Schema } from 'mongoose';

export interface IGmailAccount extends Document {
  userId: mongoose.Types.ObjectId;
  googleSubject?: string;
  gmailEmail: string;
  gmailAccessToken: string;
  gmailRefreshToken: string;
  gmailTokenExpiry?: Date;
  gmailConnected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gmailAccountSchema = new Schema<IGmailAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    googleSubject: { type: String, default: '' },
    gmailEmail: { type: String, required: true, lowercase: true, trim: true },
    gmailAccessToken: { type: String, default: '' },
    gmailRefreshToken: { type: String, default: '' },
    gmailTokenExpiry: { type: Date, default: null },
    gmailConnected: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IGmailAccount>('GmailAccount', gmailAccountSchema);
