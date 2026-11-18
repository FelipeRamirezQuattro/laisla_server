import mongoose from 'mongoose';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export const TZ = 'America/Bogota';

/** Returns current time as a Date whose UTC value equals the Colombia local clock time.
 *  e.g. at 20:40 Colombia → returns a Date that MongoDB stores as ...T20:40:00Z */
export function localNow(): Date {
  return toZonedTime(new Date(), TZ);
}

/** Inverse of localNow(): turns a timestamp stored with localNow() (openedAt/closedAt of a shift)
 *  back into the real instant, so it can be compared with fields stored via `new Date()`
 *  (e.g. Order.closedAt). Uses the live offset of localNow(), so it holds whatever the server's TZ is. */
export function localToInstant(stored: Date): Date {
  const offset = localNow().getTime() - Date.now();
  return new Date(stored.getTime() - offset);
}

/** Patches all Mongoose models to store createdAt/updatedAt in Colombia local time.
 *  Must be called after all models are imported. */
export function applyTimezonePlugin(): void {
  const plugin = (schema: mongoose.Schema) => {
    if (!schema.get('timestamps')) return;

    schema.pre('save', function (next) {
      const now = localNow();
      if (this.isNew) this.set('createdAt', now);
      this.set('updatedAt', now);
      next();
    });

    schema.pre(
      ['updateOne', 'findOneAndUpdate', 'updateMany'],
      function (next) {
        this.set({ updatedAt: localNow() });
        next();
      }
    );
  };

  // Apply to every already-loaded model schema
  mongoose.modelNames().forEach((name) =>
    mongoose.model(name).schema.plugin(plugin)
  );
  // Apply to any future schemas
  mongoose.plugin(plugin);
}

export function localStartOfDay(date: Date = new Date()): Date {
  return fromZonedTime(startOfDay(toZonedTime(date, TZ)), TZ);
}

export function localEndOfDay(date: Date = new Date()): Date {
  return fromZonedTime(endOfDay(toZonedTime(date, TZ)), TZ);
}

export function localDaysAgo(days: number): Date {
  return localStartOfDay(subDays(new Date(), days));
}

// These format a Date produced by localNow() (whose UTC fields already equal
// the Bogota wall-clock time) — formatting with TZ again would double-convert.
export function formatLocalDate(date: Date): string {
  return formatInTimeZone(date, 'UTC', 'yyyy-MM-dd');
}

export function formatLocalTime(date: Date): string {
  return formatInTimeZone(date, 'UTC', 'HH:mm:ss');
}

export function parseLocalDateInput(value?: string | Date | null): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fromZonedTime(`${value}T00:00:00`, TZ);
  }
  return new Date(value);
}
