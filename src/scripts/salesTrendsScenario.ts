/**
 * Escenario del reporte de tendencias de venta (SOLO LOCAL).
 *
 * Crea pedidos facturados en días y horas (hora de Colombia) conocidos, incluido uno a las
 * 23:30 del domingo (que en UTC cae el lunes) y una cortesía, llama al controlador real y
 * compara contra valores calculados a mano. Usa productos "ZZ Prueba" para no depender de
 * otras ventas del rango. Borra lo que crea.
 *
 *   npx ts-node --transpile-only src/scripts/salesTrendsScenario.ts
 */
import mongoose from 'mongoose';
import { fromZonedTime } from 'date-fns-tz';
import { applyTimezonePlugin, TZ } from '../utils/timezone';
import '../models/User';
import Order from '../models/Order';
import Product from '../models/Product';
import { getSalesTrendsReport } from '../controllers/reportController';

const URI = process.env.SCENARIO_URI ?? 'mongodb://localhost:27017/alma-origen';
if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(URI)) {
  console.error(`Rechazado: solo se ejecuta contra MongoDB local (${URI})`);
  process.exit(1);
}
applyTimezonePlugin();

const USER = new mongoose.Types.ObjectId();
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? `  = ${JSON.stringify(actual)}` : `\n        esperado: ${JSON.stringify(expected)}\n        obtenido: ${JSON.stringify(actual)}`}`);
}

async function call(query: Record<string, string>) {
  let status = 200;
  let body: any = null;
  const res: any = { status: (c: number) => { status = c; return res; }, json: (b: unknown) => { body = b; return res; } };
  await getSalesTrendsReport({ query } as any, res);
  return { status, body };
}

// closedAt a partir de una hora local de Colombia, p. ej. '2026-11-14T10:30:00'
const at = (local: string) => fromZonedTime(local, TZ);

async function sell(local: string, items: Array<{ productId: unknown; quantity: number; unitPrice: number; complimentary?: boolean }>) {
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  await Order.create({
    orderType: 'walk-in', status: 'billed', subtotal: total, total, createdBy: USER, notes: 'ZZ Prueba tendencias',
    closedAt: at(local), billedAt: at(local),
    items: items.map((i) => ({ productName: 'ZZ', productType: 'product', ...i })),
  });
}

async function main() {
  await mongoose.connect(URI);
  const p1 = await Product.create({ name: 'ZZ Prueba tendencia 1', price: 5000, category: 'coffee' });
  const p2 = await Product.create({ name: 'ZZ Prueba tendencia 2', price: 8000, category: 'food' });

  try {
    // 14-nov y 7-nov son sábados; 9-nov lunes; 15-nov domingo
    await sell('2026-11-14T10:30:00', [{ productId: p1._id, quantity: 3, unitPrice: 5000 }, { productId: p2._id, quantity: 1, unitPrice: 8000 }]);
    await sell('2026-11-14T15:10:00', [{ productId: p1._id, quantity: 2, unitPrice: 5000 }]);
    await sell('2026-11-07T10:45:00', [{ productId: p1._id, quantity: 4, unitPrice: 5000 }]);
    await sell('2026-11-09T08:00:00', [{ productId: p2._id, quantity: 2, unitPrice: 8000 }]);
    await sell('2026-11-15T23:30:00', [{ productId: p1._id, quantity: 1, unitPrice: 5000 }]); // domingo 23:30 (lunes en UTC)
    await sell('2026-11-09T08:05:00', [{ productId: p1._id, quantity: 5, unitPrice: 0, complimentary: true }]); // cortesía: no cuenta

    const range = { dateFrom: '2026-11-01', dateTo: '2026-11-15' };
    const cellOf = (b: any, dow: number, hour: number) => b.heatmap.find((c: any) => c.dow === dow && c.hour === hour);

    console.log('--- Producto 1 ---');
    const r1 = (await call({ ...range, productId: String(p1._id) })).body;
    check('unidades totales: 3+2+4+1 (la cortesía de 5 no cuenta)', r1.totals.units, 10);
    check('valor total', r1.totals.revenue, 50000);
    check('sábado 10:00', cellOf(r1, 6, 10).units, 7);
    check('sábado 15:00', cellOf(r1, 6, 15).units, 2);
    check('domingo 23:00 (hora Colombia, no UTC)', cellOf(r1, 7, 23).units, 1);
    check('lunes 08:00 vacío: la cortesía no cuenta', cellOf(r1, 1, 8).units, 0);
    check('serie diaria', r1.daily.filter((d: any) => d.units > 0).map((d: any) => [d.date, d.units]), [['2026-11-07', 4], ['2026-11-14', 5], ['2026-11-15', 1]]);
    check('15 días en el rango', r1.range.days, 15);
    const sat = r1.byWeekday.find((w: any) => w.dow === 6);
    check('sábado: 9 unidades, 2 sábados en el rango, promedio 4,5', [sat.units, sat.occurrences, sat.avgUnits], [9, 2, 4.5]);
    check('pico = sábado 10:00', r1.peaks.cell, { dow: 6, label: 'Sábado', hour: 10, units: 7 });

    console.log('--- Producto 2 ---');
    const r2 = (await call({ ...range, productId: String(p2._id) })).body;
    check('sábado 10:00 = 1 y lunes 08:00 = 2', [cellOf(r2, 6, 10).units, cellOf(r2, 1, 8).units], [1, 2]);

    console.log('--- Lista de productos (no se filtra por producto) ---');
    const list = (await call({ ...range, productId: String(p1._id) })).body.products;
    check('incluye ambos productos con sus unidades (10 y 3)', list.filter((x: any) => [String(p1._id), String(p2._id)].includes(x.productId)).map((x: any) => x.units).sort((a: number, b: number) => b - a), [10, 3]);

    console.log('--- Validaciones ---');
    check('fecha inválida → 400', (await call({ dateFrom: '15/11/2026', dateTo: '2026-11-15' })).status, 400);
    check('desde > hasta → 400', (await call({ dateFrom: '2026-11-16', dateTo: '2026-11-15' })).status, 400);
    check('producto inválido → 400', (await call({ ...range, productId: 'xyz' })).status, 400);
    check('rango > 366 días → 400', (await call({ dateFrom: '2025-01-01', dateTo: '2026-11-15' })).status, 400);
    check('sin parámetros usa las últimas 8 semanas (56 días)', (await call({})).body.range.days, 56);
  } finally {
    await Order.deleteMany({ notes: 'ZZ Prueba tendencias' });
    await Product.deleteMany({ _id: { $in: [p1._id, p2._id] } });
    console.log('\nLimpieza: pedidos y productos de prueba eliminados.');
  }

  console.log(failures === 0 ? '\nTODO CUADRA' : `\n${failures} verificación(es) FALLARON`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(2);
});
