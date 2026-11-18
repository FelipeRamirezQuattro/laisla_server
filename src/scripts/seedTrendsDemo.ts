/**
 * Datos de DEMO para ver el reporte de tendencias (SOLO LOCAL): ~8 semanas de pedidos con un
 * patrón realista (sábados y domingos fuertes, picos a media mañana y a la tarde).
 * Todo queda marcado con notes = 'ZZ Demo tendencias'. Para borrarlo:
 *   npx ts-node --transpile-only src/scripts/seedTrendsDemo.ts --clean
 */
import mongoose from 'mongoose';
import { fromZonedTime } from 'date-fns-tz';
import { applyTimezonePlugin, TZ } from '../utils/timezone';
import '../models/User';
import Order from '../models/Order';
import Product from '../models/Product';

const URI = 'mongodb://localhost:27017/alma-origen';
const MARK = 'ZZ Demo tendencias';
applyTimezonePlugin();

const PRODUCTS = [
  { name: 'ZZ Demo Latte', price: 9000, weight: 5 },
  { name: 'ZZ Demo Capuchino', price: 8500, weight: 3 },
  { name: 'ZZ Demo Brownie', price: 7000, weight: 3 },
  { name: 'ZZ Demo Sándwich', price: 16000, weight: 2 },
  { name: 'ZZ Demo Jugo de naranja', price: 6500, weight: 1 },
];
// intensidad relativa por día (1 = lunes … 7 = domingo) y por hora
const DAY = [0, 0.6, 0.6, 0.7, 0.9, 1.5, 1.8];
const HOUR: Record<number, number> = { 7: 0.4, 8: 0.8, 9: 1, 10: 1.6, 11: 1.8, 12: 1.2, 13: 0.9, 14: 0.8, 15: 1.3, 16: 1.5, 17: 1.1, 18: 0.6, 19: 0.3 };

const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const pick = () => {
  const total = PRODUCTS.reduce((a, p) => a + p.weight, 0);
  let r = rnd() * total;
  return PRODUCTS.find((p) => (r -= p.weight) <= 0) ?? PRODUCTS[0];
};

async function main() {
  await mongoose.connect(URI);
  await Order.deleteMany({ notes: MARK });
  await Product.deleteMany({ name: /^ZZ Demo/ });
  if (process.argv.includes('--clean')) {
    console.log('Datos de demo eliminados.');
    return;
  }
  const products = await Product.insertMany(PRODUCTS.map((p) => ({ name: p.name, price: p.price, category: 'coffee' })));
  const byName = new Map(products.map((p) => [p.name, p]));
  const user = new mongoose.Types.ObjectId();
  const today = new Date();
  const docs: any[] = [];
  for (let back = 55; back >= 0; back--) {
    const day = new Date(today.getTime() - back * 86_400_000);
    const ymd = day.toLocaleDateString('en-CA', { timeZone: TZ });
    const dow = ((new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    for (const [hourStr, hw] of Object.entries(HOUR)) {
      const n = Math.round(DAY[dow - 1] * hw * 3 * (0.7 + rnd() * 0.6));
      for (let i = 0; i < n; i++) {
        const when = fromZonedTime(`${ymd}T${hourStr.padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}:00`, TZ);
        if (when > today) continue;
        const p = pick();
        const q = 1 + Math.floor(rnd() * 2);
        docs.push({
          orderType: 'walk-in', status: 'billed', subtotal: p.price * q, total: p.price * q, createdBy: user, notes: MARK,
          closedAt: when, billedAt: when,
          items: [{ productId: byName.get(p.name)!._id, productName: p.name, productType: 'product', quantity: q, unitPrice: p.price }],
        });
      }
    }
  }
  await Order.insertMany(docs);
  console.log(`Creados ${docs.length} pedidos de demo.`);
}
main().then(() => mongoose.disconnect()).catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });
