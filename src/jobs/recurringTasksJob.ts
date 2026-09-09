import cron from 'node-cron';
import Task from '../models/Task';
import { computeNextOccurrence } from '../utils/recurrence';

export async function resetDueRecurringTasks(): Promise<number> {
  const dueTasks = await Task.find({
    isRecurring: true,
    status: 'done',
    nextOccurrenceAt: { $lte: new Date() },
  });

  for (const task of dueTasks) {
    task.status = 'pending';
    task.completedAt = undefined;
    if (task.recurrence) {
      task.nextOccurrenceAt = computeNextOccurrence(task.recurrence);
    }
    await task.save();
  }

  return dueTasks.length;
}

export function startRecurringTasksJob(): void {
  // Corre una vez al día a las 00:05 (hora del servidor) para reiniciar tareas recurrentes vencidas.
  cron.schedule('5 0 * * *', () => {
    resetDueRecurringTasks().catch((error) => {
      console.error('Error al reiniciar tareas recurrentes:', error);
    });
  });
}
