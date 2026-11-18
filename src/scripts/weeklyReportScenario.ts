/**
 * Escenario del reporte semanal de recetas (SOLO LOCAL).
 *
 * Crea pedidos facturados de prueba repartidos en tres semanas (venta directa de receta, venta
 * por un producto enlazado a la receta y cortesías), llama al controlador real y compara la
 * DIFERENCIA contra el estado previo, así no depende de las ventas que ya existan. Borra lo creado.
 *
 *   npx ts-node --transpile-only src/scripts/weeklyReportScenario.ts
 */
import mongoose from 'mongoose';
import { applyTimezonePlugin } from '../utils/timezone';
import '../models/User';
import Order from '../models/Order';
import Product from '../models/Product';
import Recipe from '../costs/models/Recipe';
import { getRecipesWeeklyReport } from '../controllers/reportController';

const URI = process.env.SCENARIO_URI ?? 'mongodb://localhost:27017/alma-origen';
if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(URI)) {
  console.error(`Rechazado: solo se ejecuta contra MongoDB local (${URI})`);
  process.exit(1);
}
applyTimezonePlugin();

const DAY = 86_400_000;
const now = new Date();
const USER = new mongoose.Types.ObjectId();
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? `  = ${JSON.stringify(actual)}` : `\n        esperado: ${JSON.stringify(expected)}\n        obtenido: ${JSON.stringify(actual)}`}`);
}

async function report(weeks = 3) {
  let body: any = null;
  const res: any = { status: () => res, json: (b: unknown) => { body = b; return res; } };
  await getRecipesWeeklyReport({ query: { weeks: String(weeks) } } as any, res);
  return body;
}

const entry = (r: any, id: string | null) => r.recipes.find((x: any) => x.recipeId === id);

async function sellOrder(daysAgo: number, items: Array<Record<string, unknown>>) {
  const total = items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
  await Order.create({
    orderType: 'walk-in', status: 'billed', subtotal: total, total, createdBy: USER, notes: 'ZZ Prueba reporte',
    closedAt: new Date(now.getTime() - daysAgo * DAY), billedAt: new Date(now.getTime() - daysAgo * DAY),
    items: items.map((i) => ({ productName: 'ZZ Prueba', ...i })),
  });
}

async function main() {
  await mongoose.connect(URI);
  const recipes = await Recipe.find().limit(2).lean();
  if (recipes.length < 2) throw new Error('Se necesitan al menos 2 recetas en la base local');
  const [r0, r1] = recipes.map((r) => String(r._id));

  const productoEnlazado = await Product.create({ name: 'ZZ Prueba producto enlazado', price: 5000, category: 'coffee', recipeId: r0 });
  const productoSinReceta = await Product.create({ name: 'ZZ Prueba producto sin receta', price: 3000, category: 'other' });

  try {
    const before = await report();
    const weekKeys: string[] = before.weeks.map((w: any) => w.key);
    check('3 semanas, la última es la actual (parcial)', before.weeks.map((w: any) => w.partial), [false, false, true]);

    // hace 14 días (semana W-2): receta0 directa ×3 + producto enlazado a receta0 ×2
    await sellOrder(14, [
      { productId: r0, productType: 'recipe', quantity: 3, unitPrice: 6000 },
      { productId: productoEnlazado._id, productType: 'product', quantity: 2, unitPrice: 5000 },
    ]);
    // hace 7 días (semana W-1): receta0 ×8, receta1 ×4 y un producto sin receta ×2
    await sellOrder(7, [
      { productId: r0, productType: 'recipe', quantity: 8, unitPrice: 6000 },
      { productId: r1, productType: 'recipe', quantity: 4, unitPrice: 7000 },
      { productId: productoSinReceta._id, productType: 'product', quantity: 2, unitPrice: 3000 },
    ]);
    // hoy (semana actual): una cortesía de receta0
    await sellOrder(0, [{ productId: r0, productType: 'recipe', quantity: 1, unitPrice: 0, complimentary: true }]);

    const after = await report();
    const weekly = (rep: any, id: string | null, field: 'sold' | 'complimentary') =>
      weekKeys.map((k) => (entry(rep, id)?.weekly.find((w: any) => w.key === k)?.[field] ?? 0));
    const delta = (id: string | null, field: 'sold' | 'complimentary') =>
      weekly(after, id, field).map((v, i) => v - weekly(before, id, field)[i]);
    const totalDelta = (id: string | null, field: 'totalSold' | 'totalComplimentary') =>
      (entry(after, id)?.[field] ?? 0) - (entry(before, id)?.[field] ?? 0);

    console.log('--- Receta 0 (directa + producto enlazado) ---');
    check('vendidas por semana', delta(r0, 'sold'), [5, 8, 0]);
    check('cortesías por semana', delta(r0, 'complimentary'), [0, 0, 1]);
    check('acumulado a la fecha (vendidas)', totalDelta(r0, 'totalSold'), 13);
    check('acumulado a la fecha (cortesías)', totalDelta(r0, 'totalComplimentary'), 1);
    console.log('--- Receta 1 ---');
    check('vendidas por semana', delta(r1, 'sold'), [0, 4, 0]);
    console.log('--- Producto sin receta ---');
    check('suma a "Sin receta"', delta(null, 'sold'), [0, 2, 0]);

    const lastWeeks = await report(8);
    check('con weeks=8 devuelve 8 semanas', lastWeeks.weeks.length, 8);
    check('semana desconocida cae al valor por defecto (8)', (await (async () => {
      let body: any; const res: any = { status: () => res, json: (b: unknown) => { body = b; return res; } };
      await getRecipesWeeklyReport({ query: { weeks: 'abc' } } as any, res); return body.weeks.length;
    })()), 8);
  } finally {
    await Order.deleteMany({ notes: 'ZZ Prueba reporte' });
    await Product.deleteMany({ _id: { $in: [productoEnlazado._id, productoSinReceta._id] } });
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
