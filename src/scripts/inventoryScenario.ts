/**
 * Escenario de prueba de vencimientos y alertas de inventario (SOLO LOCAL).
 *
 * Crea insumos "ZZ Prueba …" con lotes que vencen (por fecha y por vida útil), ventas y consumo
 * histórico; ejecuta las funciones reales (registerInsumoPurchase, procesarVencimientos,
 * evaluarAlertasInsumos) y compara contra valores calculados a mano. Al terminar borra todo lo
 * que creó (insumos, movimientos y notificaciones de prueba). No toca ningún otro dato.
 *
 *   npx ts-node --transpile-only src/scripts/inventoryScenario.ts
 * (usa mongodb://localhost:27017/alma-origen; otra URI local con INVENTORY_SCENARIO_URI)
 */
import mongoose from 'mongoose';
import { formatInTimeZone } from 'date-fns-tz';
import { applyTimezonePlugin, TZ } from '../utils/timezone';
import '../models/User';
import '../models/Provider';
import User from '../models/User';
import Notification from '../models/Notification';
import Insumo from '../inventario/models/Insumo';
import InsumoCategoria from '../inventario/models/InsumoCategoria';
import InsumoStockMovement from '../inventario/models/InsumoStockMovement';
import Recipe from '../costs/models/Recipe';
import Order from '../models/Order';
import { deductFromOrder } from '../costs/services/InventoryDeductionService';
import { registerInsumoPurchase } from '../inventario/services/PurchaseRegistrationService';
import { procesarVencimientos } from '../inventario/services/ExpiryOrchestration';
import { evaluarAlertasInsumos } from '../inventario/services/StockAlertOrchestration';

const URI = process.env.INVENTORY_SCENARIO_URI ?? 'mongodb://localhost:27017/alma-origen';
if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(URI)) {
  console.error(`Rechazado: solo se ejecuta contra MongoDB local (${URI})`);
  process.exit(1);
}
applyTimezonePlugin();

const DAY = 86_400_000;
const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const ymd = (d: Date) => formatInTimeZone(d, TZ, 'yyyy-MM-dd');
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? `  = ${JSON.stringify(actual)}` : `\n        esperado: ${JSON.stringify(expected)}\n        obtenido: ${JSON.stringify(actual)}`}`);
}

const stockOf = async (insumoId: unknown) => {
  const rows = await InsumoStockMovement.find({ insumoId, estado: 'APROBADO' }).lean();
  return rows.reduce((s, m) => s + m.cantidadBase, 0);
};

async function sale(insumoId: unknown, unidad: string, cantidad: number, base: number, daysAgo: number) {
  await InsumoStockMovement.create({
    insumoId, tipo: 'VENTA_AUTOMATICA', estado: 'APROBADO',
    cantidad, unidad, cantidadBase: -base, fecha: ago(daysAgo),
  });
}

async function main() {
  await mongoose.connect(URI);
  const userId = String((await User.findOne({ isActive: true }).select('_id').lean())!._id);
  const activeUsers = await User.countDocuments({ isActive: true });
  const categoria = await InsumoCategoria.findOne().lean();
  if (!categoria) throw new Error('No hay categorías de insumos en la base local');

  // limpieza previa por si una corrida anterior quedó a medias
  const old = await Insumo.find({ nombre: /^ZZ Prueba/ }).select('_id').lean();
  await cleanup(old.map((o) => o._id));

  const leche = await Insumo.create({ nombre: 'ZZ Prueba Leche', categoriaId: categoria._id, unidad: 'LT', orden: 9999, tipoVencimiento: 'FECHA', stockMinimo: 2 });
  const aguacate = await Insumo.create({ nombre: 'ZZ Prueba Aguacate', categoriaId: categoria._id, unidad: 'UND', orden: 9999, tipoVencimiento: 'VIDA_UTIL', vidaUtilDias: 3 });
  const ids = [leche._id, aguacate._id];

  try {
    console.log('--- Leche: dos lotes, uno vencido ---');
    // Lote A: 10 L comprados hace 20 días, vencieron hace 10. Lote B: 10 L hace 5 días, vencen en 5.
    await registerInsumoPurchase({ insumoId: String(leche._id), quantity: 10, unit: 'LT', date: ago(20), cost: 30000, expiryDate: ymd(ago(10)), userId });
    await registerInsumoPurchase({ insumoId: String(leche._id), quantity: 10, unit: 'LT', date: ago(5), cost: 32000, expiryDate: ymd(ago(-5)), userId });
    await sale(leche._id, 'LT', 9, 9000, 3); // se vendieron 9 L → quedan 11 L

    let r = await procesarVencimientos(now);
    const lecheVenc = r.filter((v) => v.insumoId === String(leche._id));
    // FIFO: los 11 L que quedan son 10 del lote B + 1 del lote A (vencido)
    check('vencido de leche (lote A)', lecheVenc.map((v) => [v.cantidad, v.unidad]), [[1, 'LT']]);
    const mov = await InsumoStockMovement.findOne({ insumoId: leche._id, tipo: 'VENCIMIENTO' }).lean();
    check('movimiento Vencido queda PENDIENTE', mov?.estado, 'PENDIENTE');
    check('cantidadBase negativa', mov?.cantidadBase, -1000);
    check('stock aprobado aún no cambia (pendiente)', await stockOf(leche._id), 11000);

    r = await procesarVencimientos(now);
    check('segunda corrida no duplica (idempotente)', r.filter((v) => v.insumoId === String(leche._id)).length, 0);

    await InsumoStockMovement.updateOne({ _id: mov!._id }, { $set: { estado: 'APROBADO' } });
    check('al aprobar, el stock baja a 10 L', await stockOf(leche._id), 10000);

    console.log('\n--- Leche: alerta de stock bajo (mínimo 2 L) ---');
    let a = await evaluarAlertasInsumos([String(leche._id)], now);
    check('con 10 L no hay alerta', a.stockBajo, []);
    await sale(leche._id, 'LT', 9, 9000, 0); // queda 1 L
    a = await evaluarAlertasInsumos([String(leche._id)], now);
    check('con 1 L alerta de stock bajo', a.stockBajo, ['ZZ Prueba Leche']);
    check('una notificación por usuario activo', await Notification.countDocuments({ entityId: leche._id, type: 'stock_low' }), activeUsers);
    a = await evaluarAlertasInsumos([String(leche._id)], now);
    check('no se repite mientras siga bajo', await Notification.countDocuments({ entityId: leche._id, type: 'stock_low' }), activeUsers);
    await registerInsumoPurchase({ insumoId: String(leche._id), quantity: 10, unit: 'LT', date: now, expiryDate: ymd(ago(-7)), userId });
    await evaluarAlertasInsumos([String(leche._id)], now);
    check('al reponer se rearma la alerta', (await Insumo.findById(leche._id))!.alertaStockBajoActiva, false);

    console.log('\n--- Aguacate: vida útil de 3 días y consumo alto ---');
    await registerInsumoPurchase({ insumoId: String(aguacate._id), quantity: 1000, unit: 'UND', date: ago(40), expiryDate: ymd(ago(-300)), userId }); // base sin vencer
    await registerInsumoPurchase({ insumoId: String(aguacate._id), quantity: 5, unit: 'UND', date: ago(5), userId }); // vence hace 2 días (5−3)
    const lote = await InsumoStockMovement.findOne({ insumoId: aguacate._id, cantidad: 5 }).lean();
    check('vida útil: vence compra + 3 días', ymd(lote!.fechaVencimiento as Date), ymd(ago(2)));
    // consumo: 10 por semana las 4 semanas previas y 20 en la última semana
    for (const d of [10, 17, 24, 31]) await sale(aguacate._id, 'UND', 10, 10, d);
    await sale(aguacate._id, 'UND', 20, 20, 2);
    r = await procesarVencimientos(now);
    check('vencido de aguacate', r.filter((v) => v.insumoId === String(aguacate._id)).map((v) => [v.cantidad, v.unidad]), [[5, 'UND']]);
    a = await evaluarAlertasInsumos([String(aguacate._id)], now);
    check('consumo alto: 20 > 1,5 × 10', a.consumoAlto, ['ZZ Prueba Aguacate']);
    a = await evaluarAlertasInsumos([String(aguacate._id)], now);
    check('no repite en 7 días', await Notification.countDocuments({ entityId: aguacate._id, type: 'stock_high_usage' }), activeUsers);

    console.log('\n--- Venta facturada: el descuento entra aprobado ---');
    const receta = await Recipe.findOne({ 'variants.0.ingredients.0.ingredientType': 'raw' }).lean();
    if (!receta) {
      console.log('(sin recetas con ingredientes directos en la base local: se omite)');
    } else {
      const variante = receta.variants[0];
      const pedido = await Order.create({
        orderType: 'walk-in', status: 'delivered', subtotal: 1, total: 1, createdBy: userId, notes: 'ZZ Prueba descuento',
        items: [{ productId: receta._id, productType: 'recipe', variantSize: variante.size, productName: 'ZZ Prueba', quantity: 1, unitPrice: 1 }],
      });
      try {
        const creados = await deductFromOrder(pedido._id as any, pedido.items as any);
        const movs = await InsumoStockMovement.find({ orderId: pedido._id, tipo: 'VENTA_AUTOMATICA' }).lean();
        check('se crearon movimientos de venta', creados > 0 && movs.length === creados, true);
        check('todos quedan APROBADOS al facturar', [...new Set(movs.map((m) => m.estado))], ['APROBADO']);
        check('con fecha de aprobación', movs.every((m) => !!m.aprobadoEn), true);
        check('salidas (cantidadBase negativa)', movs.every((m) => m.cantidadBase < 0), true);
        check('idempotente: facturar de nuevo no duplica', await deductFromOrder(pedido._id as any, pedido.items as any), 0);
      } finally {
        await InsumoStockMovement.deleteMany({ orderId: pedido._id });
        await Order.deleteOne({ _id: pedido._id });
      }
    }
  } finally {
    await cleanup(ids);
    console.log('\nLimpieza: insumos, movimientos y notificaciones de prueba eliminados.');
  }

  console.log(failures === 0 ? '\nTODO CUADRA' : `\n${failures} verificación(es) FALLARON`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

async function cleanup(ids: unknown[]) {
  if (ids.length === 0) return;
  await InsumoStockMovement.deleteMany({ insumoId: { $in: ids } });
  await Notification.deleteMany({ entityId: { $in: ids } });
  await Insumo.deleteMany({ _id: { $in: ids } });
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(2);
});
