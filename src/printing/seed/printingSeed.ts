import mongoose from 'mongoose';
import { env } from '../../config/env';
import PrintConfig from '../models/PrintConfig';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Conectado a MongoDB');

  const existing = await PrintConfig.findOne();
  if (existing) {
    console.log('ℹ️  Ya existe un PrintConfig, no se crea uno nuevo.');
  } else {
    await PrintConfig.create({});
    console.log('✅ PrintConfig creado con los valores por defecto (auto-impresión activa, comandas desactivadas).');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
