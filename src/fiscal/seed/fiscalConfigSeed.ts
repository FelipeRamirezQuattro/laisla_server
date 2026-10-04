import mongoose from 'mongoose';
import { env } from '../../config/env';
import FiscalConfig from '../models/FiscalConfig';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Conectado a MongoDB');

  const existing = await FiscalConfig.findOne();
  if (existing) {
    console.log('ℹ️  Ya existe un FiscalConfig, no se crea uno nuevo.');
  } else {
    await FiscalConfig.create({
      enabled: false,
      environment: 'TEST',
      provider: 'MOCK',
      issuer: {
        personType: 'NATURAL',
        idType: 'CC',
        idNumber: '0000000000',
        businessName: 'Nombre del emisor (ejemplo)',
        tradeName: 'La Isla Café Picnic',
        fiscalResponsibilities: [],
        ivaResponsible: false,
        consumptionTaxResponsible: false,
        address: 'Dirección de ejemplo',
        municipality: 'Ibagué',
        email: 'facturacion@laislacafepicnic.com',
      },
      numbering: [],
      alertThresholds: { rangeConsumedPercent: 80, daysBeforeExpiry: 30 },
    });
    console.log('✅ FiscalConfig de ejemplo creado (enabled: false, provider: MOCK).');
    console.log('   Edítalo con datos reales antes de habilitar la emisión electrónica.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
