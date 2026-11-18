/**
 * Escenario de prueba del cierre de caja (SOLO LOCAL).
 *
 * Crea un turno con pedidos en todos los métodos de pago (incluidos pagos
 * divididos, cortesía y pedido legado), gastos y movimientos de caja; cierra el
 * turno y compara lo que calcula el sistema contra valores calculados a mano
 * aquí mismo. Ejecuta las funciones reales del backend (closeOrder,
 * createDailyExpense, submitClosingCount, ...), no una copia de su lógica.
 *
 * Por defecto usa una base APARTE (alma-origen-cierre-test):
 *   npx ts-node --transpile-only src/scripts/cashClosingScenario.ts
 * Se borra y recrea cada vez que se ejecuta. Para inspeccionarla desde la app,
 * arranca el backend con MONGODB_URI=mongodb://localhost:27017/alma-origen-cierre-test
 * Para correrlo sobre la base de desarrollo (reemplaza pedidos, gastos y turnos; conserva usuarios y catálogo):
 *   SCENARIO_URI=mongodb://localhost:27017/alma-origen SCENARIO_ALLOW_DEV=1 npx ts-node --transpile-only src/scripts/cashClosingScenario.ts
 */
import mongoose from 'mongoose';
import { applyTimezonePlugin } from '../utils/timezone';
import '../models/User';
import '../models/Provider';
import '../models/Product';
import '../models/Table';
import Order from '../models/Order';
import DailyExpense from '../models/DailyExpense';
import CashShift from '../caja/models/CashShift';
import { closeOrder } from '../controllers/orderController';
import { createDailyExpense } from '../controllers/dailyExpenseController';
import {
  openShift,
  addMovement,
  submitClosingCount,
  getShiftBillingSummary,
  getCashBalances,
  changeOrderPayments,
  assignOrderToShift,
  CashShiftError,
} from '../caja/services/CashShiftOrchestration';

const URI = process.env.SCENARIO_URI ?? 'mongodb://localhost:27017/alma-origen-cierre-test';
const IS_TEST_DB = /test/i.test(URI);
const IS_LOCAL = /^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(URI);
// En una base que no es "test" solo se permite en localhost y con SCENARIO_ALLOW_DEV=1;
// ahí NO se borra la base: solo las colecciones de caja/ventas (usuarios y catálogo se conservan).
if (!IS_LOCAL || (!IS_TEST_DB && process.env.SCENARIO_ALLOW_DEV !== '1')) {
  console.error(`Rechazado: use una base "test" local, o localhost con SCENARIO_ALLOW_DEV=1 (${URI})`);
  process.exit(1);
}

applyTimezonePlugin();

const USER = new mongoose.Types.ObjectId().toString();
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? `  = ${JSON.stringify(actual)}` : `\n        esperado: ${JSON.stringify(expected)}\n        obtenido: ${JSON.stringify(actual)}`}`);
}

function fakeRes() {
  const out: { status: number; body: any } = { status: 200, body: null };
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(body: unknown) { out.body = body; return res; },
  };
  return { res, out };
}

async function deliveredOrder(total: number, extra: Record<string, unknown> = {}) {
  return Order.create({
    orderType: 'walk-in',
    items: [{ productId: new mongoose.Types.ObjectId(), productName: 'Prueba', quantity: 1, unitPrice: total }],
    status: 'delivered',
    subtotal: total,
    total,
    createdBy: USER,
    deliveredAt: new Date(),
    ...extra,
  });
}

async function bill(total: number, payments: { method: string; amount: number }[] | null, legacyMethod?: string) {
  const order = await deliveredOrder(total);
  const { res, out } = fakeRes();
  const body = legacyMethod ? { paymentMethod: legacyMethod } : payments ? { payments } : {};
  await closeOrder({ params: { id: String(order._id) }, body } as any, res);
  if (out.status >= 400) throw new Error(`closeOrder falló (${out.status}): ${JSON.stringify(out.body)}`);
  return order._id as mongoose.Types.ObjectId;
}

async function expense(amount: number, paymentMethod: string, description: string) {
  const { res, out } = fakeRes();
  await createDailyExpense(
    { user: { id: USER, role: 'superadmin' }, body: { type: 'OTRO', categoriaGasto: 'OTROS', amount, paymentMethod, description, date: new Date().toISOString().slice(0, 10) } } as any,
    res
  );
  if (out.status >= 400) throw new Error(`createDailyExpense falló: ${JSON.stringify(out.body)}`);
}

const denoms = (rows: [number, 'bill' | 'coin', number][]) => rows.map(([value, kind, quantity]) => ({ value, kind, quantity }));

async function main() {
  await mongoose.connect(URI);
  if (IS_TEST_DB) {
    await mongoose.connection.dropDatabase();
  } else {
    for (const name of ['orders', 'dailyexpenses', 'cashshifts', 'cashmovements', 'cashaccountadjustments', 'fiscaldocuments', 'printjobs']) {
      await mongoose.connection.collection(name).deleteMany({});
    }
  }
  console.log(`Base de pruebas: ${URI}\n`);

  // ---- Antes del turno: venta por transferencia sin turno abierto ----
  await bill(9_000, [{ method: 'transfer', amount: 9_000 }]); // J: sin turno

  // ---- Apertura: base de 200.000 ----
  const shift = await openShift({ userId: USER, denominations: denoms([[100000, 'bill', 2]]) });
  const shiftId = String(shift._id);

  // ---- Ventas dentro del turno ----
  const A = await bill(15_000, [{ method: 'cash', amount: 15_000 }]);
  await bill(20_000, [{ method: 'transfer', amount: 20_000 }]);
  await bill(12_000, [{ method: 'card', amount: 12_000 }]);
  await bill(8_000, [{ method: 'nequi', amount: 8_000 }]);
  await bill(15_000, [{ method: 'cash', amount: 5_000 }, { method: 'transfer', amount: 10_000 }]); // dividido 2
  await bill(40_000, [
    { method: 'cash', amount: 10_000 }, { method: 'transfer', amount: 10_000 },
    { method: 'card', amount: 10_000 }, { method: 'nequi', amount: 10_000 },
  ]); // dividido 4
  await bill(0, null); // cortesía total $0
  await bill(6_000, null, 'cash'); // cliente antiguo: solo paymentMethod
  await bill(12_350, [{ method: 'cash', amount: 12_350 }]); // monto con centenas

  // ---- Gastos y movimientos ----
  await expense(10_000, 'cash', 'Hielo (efectivo)');
  await expense(7_000, 'transfer', 'Proveedor (transferencia)');
  await expense(3_000, 'nequi', 'Domicilio (nequi)');
  await addMovement({ shiftId, userId: USER, isAdmin: true, type: 'WITHDRAWAL', amount: 50_000, reason: 'Retiro a caja fuerte' });
  await addMovement({ shiftId, userId: USER, isAdmin: true, type: 'CASH_IN', amount: 20_000, reason: 'Ingreso de cambio' });

  // ---- Valores esperados, calculados A MANO ----
  const cashSales = 15_000 + 5_000 + 10_000 + 6_000 + 12_350; // 48.350
  const expectedCash = 200_000 + cashSales + 20_000 - 50_000 - 10_000; // 208.350
  console.log('--- Turno abierto (antes de cerrar) ---');
  const live = await getShiftBillingSummary({ _id: shift._id, openedAt: shift.openedAt, closedAt: undefined });
  check('ventas efectivo', live.salesSnapshot.cashSales, cashSales);
  check('ventas transferencia', live.salesSnapshot.transferSales, 20_000 + 10_000 + 10_000);
  check('ventas tarjeta', live.salesSnapshot.cardSales, 12_000 + 10_000);
  check('ventas nequi', live.salesSnapshot.nequiSales, 8_000 + 10_000);
  check('total ventas', live.salesSnapshot.totalSales, 15_000 + 20_000 + 12_000 + 8_000 + 15_000 + 40_000 + 6_000 + 12_350);
  check('# pedidos del turno (incluye cortesía)', live.salesSnapshot.totalOrders, 9);
  check('gastos en efectivo del cajón', live.totalExpenses, 10_000);

  // ---- Cierre con diferencia grande y SIN notas: debe rechazar con el desglose ----
  console.log('\n--- Cierre ---');
  try {
    await submitClosingCount({ shiftId, userId: USER, isAdmin: true, denominations: denoms([[100000, 'bill', 1]]) });
    check('cierre con faltante grande sin notas se rechaza', 'aceptado', 'rechazado');
  } catch (err) {
    check('cierre con faltante grande sin notas se rechaza', err instanceof CashShiftError, true);
    check('detalle: expectedCash en el error', (err as CashShiftError).details && (err as any).details.expectedCash, expectedCash);
  }

  // ---- Cierre exacto: 208.350 = 2x100000 + 5000 + 2000 + 1000 + 200 + 100 + 50 ----
  const closed = await submitClosingCount({
    shiftId, userId: USER, isAdmin: true,
    denominations: denoms([[100000, 'bill', 2], [5000, 'bill', 1], [2000, 'bill', 1], [1000, 'bill', 1], [200, 'coin', 1], [100, 'coin', 1], [50, 'coin', 1]]),
  });
  check('conteo de cierre', closed.closingCount?.total, 208_350);
  check('expectedCash guardado', closed.expectedCash, expectedCash);
  check('diferencia = 0', closed.difference, 0);
  check('estado REVIEWED (sin aprobación)', closed.status, 'REVIEWED');
  check('snapshot transferencia', closed.salesSnapshot?.transferSales, 40_000);

  // ---- Después del cierre: otra venta por transferencia sin turno ----
  await bill(11_000, [{ method: 'transfer', amount: 11_000 }]); // K: sin turno

  // ---- Cambio de pago posterior (turno cerrado): efectivo -> transferencia ----
  console.log('\n--- Cambiar pago de pedido A (15.000 efectivo -> transferencia) con turno cerrado ---');
  await changeOrderPayments({ orderId: String(A), userId: USER, payments: [{ method: 'transfer', amount: 15_000 }] });
  const after = await CashShift.findById(shiftId);
  check('expectedCash recalculado', after?.expectedCash, expectedCash - 15_000);
  check('transferencia recalculada', after?.salesSnapshot?.transferSales, 55_000);
  check('diferencia recalculada (conteo no cambia)', after?.difference, 15_000);

  // ---- Pedido desasignado dentro de la ventana del turno ----
  console.log('\n--- Pedidos sin turno dentro de la ventana del turno ---');
  const fresh = await CashShift.findById(shiftId);
  await assignOrderToShift({ orderId: String(A), shiftId: null, userId: USER });
  const summary = await getShiftBillingSummary({ _id: fresh!._id, openedAt: fresh!.openedAt, closedAt: fresh!.closedAt });
  check('el pedido A desasignado aparece como "sin turno" del periodo', summary.salesSnapshot.unassignedOrdersCount, 1);
  await assignOrderToShift({ orderId: String(A), shiftId, userId: USER });

  // ---- Saldos por cuenta (módulo Caja): se calculan sobre TODO el historial ----
  console.log('\n--- Saldos por cuenta (Caja) ---');
  const balances = await getCashBalances();
  // transferencias: 9.000 (J) + 55.000 (turno, ya con A) + 11.000 (K) − gasto 7.000
  check('saldo transferencia', balances.transfer, 9_000 + 55_000 + 11_000 - 7_000);
  check('saldo tarjeta', balances.card, 22_000);
  check('saldo nequi', balances.nequi, 18_000 - 3_000);
  check('caja menor = conteo del cierre', balances.cash.menor, 208_350);

  // ---- Suma de pagos == total en TODOS los pedidos facturados ----
  console.log('\n--- Integridad: pagos vs total por pedido ---');
  const billed = await Order.find({ status: 'billed' }).lean();
  const bad = billed.filter((o) => {
    const sum = (o.payments ?? []).reduce((s, p) => s + p.amount, 0);
    return Math.abs(sum - o.total) > 0.5;
  });
  check('pedidos donde sum(pagos) != total', bad.length, 0);

  const expenses = await DailyExpense.countDocuments();
  console.log(`\nCreado: ${billed.length} pedidos facturados, ${expenses} gastos, 1 turno.`);
  console.log(failures === 0 ? '\nTODO CUADRA' : `\n${failures} verificación(es) FALLARON`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(2);
});
