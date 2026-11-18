/**
 * Escenario de MOD por trabajadores, gastos MANO_OBRA/GIF y sugerencia del mes anterior (SOLO LOCAL).
 *
 * Corre en una base APARTE (alma-origen-costs-test) porque guardar parámetros recalcula recetas:
 * así no se tocan los costos de la base de desarrollo. Se borra y recrea en cada ejecución.
 * Usa los controladores reales y compara contra valores calculados a mano.
 *
 *   npx ts-node --transpile-only src/scripts/costsBaselineScenario.ts
 */
import mongoose from 'mongoose';
import { fromZonedTime } from 'date-fns-tz';
import { applyTimezonePlugin, TZ } from '../utils/timezone';
import '../models/User';
import '../models/Provider';
import Order from '../models/Order';
import DailyExpense from '../models/DailyExpense';
import LaborAndOverheadParams from '../costs/models/LaborAndOverheadParams';
import { createDailyExpense, updateDailyExpense } from '../controllers/dailyExpenseController';
import { createWorker, deactivateWorker } from '../costs/controllers/workersController';
import { getSuggestion, updateParams } from '../costs/controllers/laborOverheadController';
import { getRecipeCostParams } from '../costs/services/RecipeCostOrchestrator';
import { previousMonth, monthRange } from '../costs/services/MonthlyBaselineService';
import { openShift, getShiftBillingSummary } from '../caja/services/CashShiftOrchestration';

const URI = process.env.SCENARIO_URI ?? 'mongodb://localhost:27017/alma-origen-costs-test';
if (!/test/i.test(URI) || !/^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(URI)) {
  console.error(`Rechazado: solo una base local cuyo nombre contenga "test" (${URI})`);
  process.exit(1);
}
applyTimezonePlugin();

const ADMIN = { id: new mongoose.Types.ObjectId().toString(), role: 'admin' };
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? `  = ${JSON.stringify(actual)}` : `\n        esperado: ${JSON.stringify(expected)}\n        obtenido: ${JSON.stringify(actual)}`}`);
}
const near = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;

async function call(handler: (req: any, res: any) => Promise<void>, req: Record<string, unknown>) {
  let status = 200;
  let body: any = null;
  const res: any = { status: (c: number) => { status = c; return res; }, json: (b: unknown) => { body = b; return res; } };
  await handler({ user: ADMIN, query: {}, body: {}, params: {}, ...req }, res);
  return { status, body };
}

const at = (local: string) => fromZonedTime(local, TZ);
async function sell(local: string, items: Array<{ quantity: number; complimentary?: boolean }>, status = 'billed') {
  await Order.create({
    orderType: 'walk-in', status, subtotal: 1, total: 1, createdBy: new mongoose.Types.ObjectId(), notes: 'ZZ costos',
    closedAt: at(local), billedAt: at(local),
    items: items.map((i) => ({ productId: new mongoose.Types.ObjectId(), productName: 'ZZ', productType: 'product', unitPrice: 1000, ...i })),
  });
}

async function main() {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  // ---- Parámetros iniciales (los de tu pantalla) ----
  await LaborAndOverheadParams.create({
    hourlyWage: 2000, numberOfWorkers: 3, hoursPerDay: 8, numberOfShifts: 1, monthlyCustomers: 600, productsPerCustomer: 2,
    overheadItems: [{ concept: 'Arriendo', monthlyCost: 2_800_000 }, { concept: 'Energía', monthlyCost: 500_000 }, { concept: 'Internet', monthlyCost: 150_000 }],
  });

  console.log('--- Sin trabajadores: el cálculo de siempre ---');
  let r = await call(updateParams, { body: {} });
  check('MOD mensual (2.000 × 3 × 8 × 30,4)', near(r.body.monthlyLabor, 1_459_200), true);
  check('MOD por ítem', near(r.body.laborPerItem, 1_216, 0.001), true);
  check('GIF por ítem (3.450.000 / 1.200)', near(r.body.overheadPerItem, 2_875, 0.001), true);
  check('costo por minuto (legacy)', (await getRecipeCostParams()).laborCostPerMinute, 100);
  check('los campos derivados enviados por el cliente se ignoran', (await call(updateParams, { body: { laborPerItem: 1 } })).body.laborPerItem > 1, true);

  console.log('--- Con trabajadores de distinta tarifa y horas ---');
  const ids: string[] = [];
  for (const w of [
    { name: 'ZZ Ana', hourlyRate: 5000, hoursPerDay: 8, daysPerMonth: 26 },
    { name: 'ZZ Beto', hourlyRate: 4000, hoursPerDay: 4, daysPerMonth: 30.4 },
    { name: 'ZZ Carla', hourlyRate: 6000, hoursPerDay: 6, daysPerMonth: 20 },
  ]) ids.push(String((await call(createWorker, { body: w })).body._id));
  r = await call(updateParams, { body: {} });
  check('MOD mensual = 1.040.000 + 486.400 + 720.000', near(r.body.monthlyLabor, 2_246_400), true);
  check('MOD por ítem = 2.246.400 / 1.200', near(r.body.laborPerItem, 1_872, 0.001), true);
  check('costo por minuto = (5.000+4.000+6.000)/60', (await getRecipeCostParams()).laborCostPerMinute, 250);
  check('tarifa negativa → 400', (await call(createWorker, { body: { name: 'ZZ x', hourlyRate: -1 } })).status, 400);
  await call(deactivateWorker, { params: { id: ids[2] } });
  r = await call(updateParams, { body: {} });
  check('desactivar a Carla la saca del MOD', near(r.body.monthlyLabor, 1_526_400), true);
  check('costo por minuto sin Carla', near((await getRecipeCostParams()).laborCostPerMinute, 150, 1e-9), true);

  console.log('--- Ventas del mes anterior (con casos límite) ---');
  const last = previousMonth(new Date());
  const lastDay = String(new Date(Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5)), 0)).getUTCDate()).padStart(2, '0');
  const before = previousMonth(monthRange(last).start);
  await sell(`${last}-10T10:00:00`, [{ quantity: 2 }, { quantity: 1 }]);                       // 3 u
  await sell(`${last}-11T11:00:00`, [{ quantity: 1 }, { quantity: 1, complimentary: true }]);   // 1 u (la cortesía no suma)
  await sell(`${last}-12T12:00:00`, [{ quantity: 3, complimentary: true }]);                    // solo cortesías: no cuenta como cliente
  await sell(`${last}-13T12:00:00`, [{ quantity: 9 }], 'cancelled');                            // cancelado: no cuenta
  await sell(`${last}-${lastDay}T23:30:00`, [{ quantity: 2 }]);                                 // último día 23:30 hora Colombia: SÍ
  await sell(`${last}-01T00:10:00`, [{ quantity: 4 }]);                                         // primer día 00:10: SÍ
  await sell(`${before}-28T23:50:00`, [{ quantity: 7 }]);                                       // mes anterior al anterior: NO
  const thisMonth = new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7);
  await sell(`${thisMonth}-01T08:00:00`, [{ quantity: 5 }]);                                     // mes en curso: NO

  console.log('--- Gastos GIF y mano de obra ---');
  const expense = (body: Record<string, unknown>, user = ADMIN) => call(createDailyExpense, { body: { paymentMethod: 'transfer', ...body }, user });
  check('tipo desconocido → 400', (await expense({ type: 'NOMINA', amount: 1, date: `${last}-05` })).status, 400);
  check('GIF sin concepto → 400', (await expense({ type: 'GIF', amount: 1000, date: `${last}-05` })).status, 400);
  check('MANO_OBRA sin trabajador → 400', (await expense({ type: 'MANO_OBRA', amount: 1000, date: `${last}-05` })).status, 400);
  check('un cajero no puede registrar mano de obra → 403', (await expense({ type: 'MANO_OBRA', workerId: ids[0], amount: 1000, date: `${last}-05` }, { id: ADMIN.id, role: 'user' })).status, 403);
  await expense({ type: 'GIF', gifConcept: 'Arriendo', amount: 3_000_000, date: `${last}-05` });
  await expense({ type: 'GIF', gifConcept: 'energia', amount: 200_000, date: `${last}-06` });
  await expense({ type: 'GIF', gifConcept: 'Energía ', amount: 220_000, date: `${last}-20` });
  await expense({ type: 'GIF', gifConcept: 'Seguro', amount: 90_000, date: `${last}-07` });
  await expense({ type: 'GIF', gifConcept: 'Arriendo', amount: 9_999_999, date: `${thisMonth}-02` });          // mes en curso: no cuenta
  await expense({ type: 'MANO_OBRA', workerId: ids[0], amount: 1_000_000, date: `${last}-15` });
  await expense({ type: 'MANO_OBRA', workerId: ids[1], amount: 400_000, date: `${last}-15` });
  await expense({ type: 'OTRO', categoriaGasto: 'ARRIENDO', description: 'otro arriendo', amount: 5_000_000, date: `${last}-08` }); // gasto general: no es GIF
  const created = await DailyExpense.findOne({ type: 'MANO_OBRA', workerId: ids[0] }).lean();
  check('descripción automática del pago', created?.description, 'Pago a ZZ Ana');

  console.log('--- Editar gastos: el detalle automático sigue al concepto / trabajador ---');
  const gifExp = await DailyExpense.findOne({ type: 'GIF', gifConcept: 'Seguro' });
  const edit = (id: unknown, body: Record<string, unknown>) => call(updateDailyExpense, { params: { id: String(id) }, body });
  let er = await edit(gifExp!._id, { gifConcept: 'Seguro de local', description: gifExp!.description });
  check('GIF: el detalle automático cambia con el concepto', [er.body.description, er.body.gifConcept], ['GIF: Seguro de local', 'Seguro de local']);
  er = await edit(gifExp!._id, { gifConcept: 'Seguro', description: 'Nota mía' });
  check('GIF: un detalle personalizado se respeta', [er.body.description, er.body.gifConcept], ['Nota mía', 'Seguro']);
  const labExp = await DailyExpense.findOne({ type: 'MANO_OBRA', workerId: ids[1] });
  er = await edit(labExp!._id, { workerId: ids[0], description: labExp!.description });
  check('MANO_OBRA: el detalle automático cambia con el trabajador', er.body.description, 'Pago a ZZ Ana');
  er = await edit(labExp!._id, { workerId: ids[1], description: 'Pago a ZZ Ana' });
  check('MANO_OBRA: volver a Beto actualiza el detalle', er.body.description, 'Pago a ZZ Beto');
  check('GIF: concepto vacío al editar → 400', (await edit(gifExp!._id, { gifConcept: '  ' })).status, 400);
  await edit(gifExp!._id, { gifConcept: 'Seguro', description: 'GIF: Seguro' }); // deja el dato como estaba para la sugerencia

  console.log('--- Sugerencia del mes anterior ---');
  const s = (await call(getSuggestion, {})).body;
  check('mes sugerido = mes anterior', s.month, last);
  check('clientes: 4 pedidos con unidades (3, 1, 2, 4)', [s.customers.orders, s.customers.units], [4, 10]);
  check('clientes/mes y productos/cliente', [s.customers.monthlyCustomers, s.customers.productsPerCustomer], [4, 2.5]);
  check('GIF por concepto', s.overhead.items.map((i: any) => [i.concept, i.paid, i.status, i.suggested]), [
    ['Arriendo', 3_000_000, 'PAGADO', 3_000_000],
    ['Energía', 420_000, 'PAGADO', 420_000],
    ['Internet', 0, 'SIN_PAGOS', 150_000],
    ['Seguro', 90_000, 'NUEVO', 90_000],
  ]);
  check('MOD planificado vs pagado', [Math.round(s.labor.plannedMonthly), s.labor.paidInMonth, s.labor.mode], [1_526_400, 1_400_000, 'WORKERS']);
  check('mes inválido → 400', (await call(getSuggestion, { query: { month: '2026-13' } })).status, 400);

  console.log('--- Aplicar la sugerencia ---');
  r = await call(updateParams, { body: { monthlyCustomers: s.customers.monthlyCustomers, productsPerCustomer: s.customers.productsPerCustomer, overheadItems: s.overhead.items.map((i: any) => ({ concept: i.concept, monthlyCost: i.suggested })), baselineMonth: last } });
  check('queda registrado el mes usado', r.body.baselineMonth, last);
  check('MOD por ítem = 1.526.400 / (4 × 2,5)', near(r.body.laborPerItem, 152_640, 0.001), true);
  check('GIF por ítem = 3.660.000 / 10', near(r.body.overheadPerItem, 366_000, 0.001), true);
  check('clientes/mes 0 → 400 (mínimo 1 del esquema)', (await call(updateParams, { body: { monthlyCustomers: 0 } })).status, 400);

  console.log('--- Caja no se rompe con los tipos nuevos ---');
  await openShift({ userId: ADMIN.id, denominations: [{ value: 100000, kind: 'bill', quantity: 1 }] });
  await expense({ type: 'GIF', gifConcept: 'Agua', amount: 10_000, paymentMethod: 'cash', date: new Date().toLocaleDateString('en-CA', { timeZone: TZ }) });
  await expense({ type: 'MANO_OBRA', workerId: ids[0], amount: 50_000, paymentMethod: 'transfer', date: new Date().toLocaleDateString('en-CA', { timeZone: TZ }) });
  const shift = await mongoose.connection.db!.collection('cashshifts').findOne({ status: 'OPEN' });
  const summary = await getShiftBillingSummary({ _id: shift!._id as any, openedAt: shift!.openedAt, closedAt: undefined });
  check('solo el efectivo del cajón resta del turno (GIF 10.000 sí, mano de obra por transferencia no)', summary.totalExpenses, 10_000);

  await mongoose.connection.dropDatabase();
  console.log(failures === 0 ? '\nTODO CUADRA (base de prueba eliminada)' : `\n${failures} verificación(es) FALLARON`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(2);
});
