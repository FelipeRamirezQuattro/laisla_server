// Migrates the legacy day-granularity CashClosing collection into the new
// shift-based CashShift collection. Run manually once per environment:
//   npm run migrate:cash-shifts
//
// Idempotent: skips any CashClosing already migrated (tracked via
// CashShift.legacySourceId). Never deletes or modifies CashClosing — the
// old collection stays in place, unread by the app after cutover, purely
// as a historical safety net.
import mongoose from 'mongoose';
import { env } from '../config/env';
import CashClosing from '../models/CashClosing';
import CashShift from '../caja/models/CashShift';
import DailyExpense from '../models/DailyExpense';
import { migrateLegacyClosingToShift } from '../caja/services/CashShiftMigrationService';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Conectado a MongoDB');

  const alreadyMigrated = await CashShift.find({ migratedFromLegacy: true }).select('legacySourceId');
  const migratedIds = new Set(alreadyMigrated.map((s) => String(s.legacySourceId)));

  const closings = await CashClosing.find().sort({ date: 1 });
  let migrated = 0;
  let skipped = 0;

  for (const closing of closings) {
    if (migratedIds.has(String(closing._id))) {
      skipped += 1;
      continue;
    }

    const { shift, expenseIdsToLink } = migrateLegacyClosingToShift({
      _id: closing._id,
      date: closing.date,
      openingCash: closing.openingCash,
      cashSales: closing.cashSales,
      cardSales: closing.cardSales,
      transferSales: closing.transferSales,
      expenses: closing.expenses,
      totalExpenses: closing.totalExpenses,
      expectedCash: closing.expectedCash,
      actualCash: closing.actualCash,
      difference: closing.difference,
      notes: closing.notes,
      closedBy: closing.closedBy,
    });

    const created = await CashShift.create({
      ...shift,
      auditLog: [{ action: 'CLOSE', by: closing.closedBy, at: closing.date, detail: { migratedFromLegacy: true } }],
    });

    if (expenseIdsToLink.length > 0) {
      await DailyExpense.updateMany(
        { _id: { $in: expenseIdsToLink } },
        { $set: { cashShiftId: created._id, locked: true, lockedAt: closing.date } }
      );
    }

    migrated += 1;
  }

  console.log(`✅ Migración completa: ${migrated} cierres migrados, ${skipped} ya migrados (omitidos).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Error en la migración:', err);
  process.exit(1);
});
