import cron from 'node-cron';
import { TZ } from '../utils/timezone';
import { procesarVencimientos } from '../inventario/services/ExpiryOrchestration';
import { evaluarAlertasInsumos } from '../inventario/services/StockAlertOrchestration';
import { notifyAllUsers, deleteOldNotifications } from '../services/notificationService';

const INVENTORY_LINK = '/admin/costos/inventario/stock';

// Revisión diaria: lotes vencidos → descuento "Vencido" pendiente + aviso, y alertas de stock.
export async function runDailyInventoryChecks(now: Date = new Date()) {
  const vencidos = await procesarVencimientos(now);
  for (const v of vencidos) {
    await notifyAllUsers({
      type: 'insumo_expired',
      title: `Vencido: ${v.nombre}`,
      message: `Se venció ${v.cantidad} ${v.unidad} de ${v.nombre}. El descuento del inventario está pendiente de aprobación.`,
      entityType: 'insumo',
      entityId: v.insumoId,
      linkTo: INVENTORY_LINK,
    });
  }
  const alertas = await evaluarAlertasInsumos(undefined, now);
  await deleteOldNotifications();
  return { vencidos, alertas };
}

export function startInventoryJob(): void {
  // Todos los días a las 00:10 hora de Colombia (el servidor corre en UTC, por eso se indica la zona).
  cron.schedule(
    '10 0 * * *',
    () => {
      runDailyInventoryChecks().catch((error) => console.error('Error en la revisión diaria de inventario:', error));
    },
    { timezone: TZ }
  );
}
