/**
 * Borra los movimientos de inventario PENDIENTES (ventas sin aprobar, ajustes, vencimientos…).
 *
 * El stock aprobado NO cambia: los pendientes nunca han contado en él. Solo desaparece la columna
 * "Pendiente venta" y el contador de "movimientos por aprobar". No toca movimientos APROBADOS ni
 * RECHAZADOS. Un movimiento "Vencido" pendiente que se borre deja su lote marcado como ya
 * procesado, así que ese vencimiento no se vuelve a generar (el stock se cuadrará a mano).
 *
 * Por defecto es un ENSAYO: muestra qué borraría y no cambia nada.
 *
 *   npx ts-node --transpile-only src/scripts/clearPendingStockMovements.ts            # ensayo
 *   npx ts-node --transpile-only src/scripts/clearPendingStockMovements.ts --apply    # borra
 *
 * Usa MONGODB_URI del .env (o de la variable de entorno). Si la base NO es local, además de
 * --apply pide escribir BORRAR para confirmar. El borrado no se puede deshacer: haz un respaldo
 * de la base antes de ejecutarlo en producción.
 */
import 'dotenv/config';
import readline from 'readline';
import mongoose from 'mongoose';
import InsumoStockMovement from '../inventario/models/InsumoStockMovement';

const uri = process.env.MONGODB_URI;
const apply = process.argv.includes('--apply');

function describeTarget(connectionString: string): string {
  // Sin usuario ni contraseña: solo servidor y nombre de la base.
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return '(URI no interpretable)';
  }
}

const isLocal = (connectionString: string) => /^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(connectionString);

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function main() {
  if (!uri) {
    console.error('Falta MONGODB_URI (defínela en .env o en el entorno).');
    process.exit(1);
  }

  console.log(`Base de datos: ${describeTarget(uri)}`);
  await mongoose.connect(uri);

  const porTipo = await InsumoStockMovement.aggregate<{ _id: string; n: number }>([
    { $match: { estado: 'PENDIENTE' } },
    { $group: { _id: '$tipo', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  const total = porTipo.reduce((sum, row) => sum + row.n, 0);
  const insumos = (await InsumoStockMovement.distinct('insumoId', { estado: 'PENDIENTE' })).length;

  if (total === 0) {
    console.log('No hay movimientos pendientes. Nada que borrar.');
    return;
  }

  console.log(`\nMovimientos pendientes: ${total} (de ${insumos} insumos)`);
  for (const row of porTipo) console.log(`  ${row._id.padEnd(18)} ${row.n}`);
  if (porTipo.some((row) => row._id === 'VENCIMIENTO')) {
    console.log('\nAviso: hay vencimientos pendientes; al borrarlos esos lotes no se volverán a descontar solos.');
  }

  if (!apply) {
    console.log('\nENSAYO: no se borró nada. Para borrar ejecuta de nuevo con --apply');
    return;
  }

  if (!isLocal(uri)) {
    console.log('\nLa base NO es local. Esta acción no se puede deshacer.');
    const answer = await ask(`Escribe BORRAR para eliminar ${total} movimientos: `);
    if (answer !== 'BORRAR') {
      console.log('Cancelado: no se borró nada.');
      return;
    }
  }

  const result = await InsumoStockMovement.deleteMany({ estado: 'PENDIENTE' });
  console.log(`\nBorrados ${result.deletedCount} movimientos pendientes.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
