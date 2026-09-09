import { ITaskRecurrence } from '../models/Task';

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function nextWeeklyOccurrence(from: Date, daysOfWeek: number[]): Date {
  const sorted = [...daysOfWeek].sort((a, b) => a - b);
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(from, offset);
    if (sorted.includes(candidate.getDay())) return candidate;
  }
  return addDays(from, 7);
}

function nextMonthlyOccurrence(from: Date, dayOfMonth: number): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const lastDayOfCandidateMonth = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
  candidate.setDate(Math.min(dayOfMonth, lastDayOfCandidateMonth));
  return candidate;
}

export function computeNextOccurrence(recurrence: ITaskRecurrence, fromDate: Date = new Date()): Date {
  const from = startOfDay(fromDate);
  switch (recurrence.frequency) {
    case 'daily':
      return addDays(from, 1);
    case 'weekly':
      return nextWeeklyOccurrence(from, recurrence.daysOfWeek?.length ? recurrence.daysOfWeek : [from.getDay()]);
    case 'monthly':
      return nextMonthlyOccurrence(from, recurrence.dayOfMonth ?? from.getDate());
    case 'custom':
      return addDays(from, Math.max(1, recurrence.interval ?? 1));
    default:
      return addDays(from, 1);
  }
}
