import mongoose, { Document, Schema } from 'mongoose';

export interface IPrintConfig extends Document {
  receiptAutoPrint: boolean;
  kitchenPrintingEnabled: boolean;
  openDrawerOnCash: boolean;
  headerText: string;
  footerText: string;
  // Printed on every receipt regardless of fiscal status — DIAN electronic
  // invoicing (backend/src/fiscal/) carries its own NIT/address snapshot,
  // but has no concept of a phone number or social handle, so these three
  // always come from here.
  businessNit: string;
  businessPhone: string;
  businessSocial: string;
  createdAt: Date;
  updatedAt: Date;
}

const printConfigSchema = new Schema<IPrintConfig>(
  {
    receiptAutoPrint: { type: Boolean, default: true },
    kitchenPrintingEnabled: { type: Boolean, default: false },
    openDrawerOnCash: { type: Boolean, default: true },
    headerText: { type: String, default: 'La Isla - Café Picnic' },
    footerText: { type: String, default: '¡Gracias por tu visita!' },
    businessNit: { type: String, default: '1110537522' },
    businessPhone: { type: String, default: '3045270892' },
    businessSocial: { type: String, default: '@laislacafepicnic' },
  },
  { timestamps: true }
);

export default mongoose.model<IPrintConfig>('PrintConfig', printConfigSchema);
