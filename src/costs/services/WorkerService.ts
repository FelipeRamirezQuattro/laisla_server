import Worker from '../models/Worker';
import type { WorkerLaborInput } from './CostCalculationService';

// Trabajadores que hoy cuentan para la mano de obra (los desactivados no suman).
export async function loadActiveWorkers(): Promise<WorkerLaborInput[]> {
  const workers = await Worker.find({ active: true }).select('hourlyRate hoursPerDay daysPerMonth').lean();
  return workers.map((w) => ({ hourlyRate: w.hourlyRate, hoursPerDay: w.hoursPerDay, daysPerMonth: w.daysPerMonth }));
}
