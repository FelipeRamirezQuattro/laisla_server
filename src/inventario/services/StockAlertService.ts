// Decisiones de las alertas de inventario. Lógica pura (sin Mongoose): se prueba directamente
// y StockAlertOrchestration la conecta con la base de datos.

// El consumo de los últimos 7 días debe superar este múltiplo del promedio semanal previo.
export const CONSUMO_ALTO_FACTOR = 1.5;
// No se repite la alerta de consumo alto de un mismo insumo antes de este plazo.
export const CONSUMO_ALTO_DIAS_ENTRE_ALERTAS = 7;

export type StockLowDecision = 'ALERTAR' | 'REARMAR' | 'NADA';

// Alerta solo al CRUZAR el mínimo; mientras siga bajo no se repite, y se rearma cuando se repone.
export function decideStockLow(input: {
  stockBase: number;
  stockMinimoBase: number | null | undefined;
  alertaActiva: boolean;
}): StockLowDecision {
  if (input.stockMinimoBase == null) return input.alertaActiva ? 'REARMAR' : 'NADA';
  const bajo = input.stockBase <= input.stockMinimoBase;
  if (bajo && !input.alertaActiva) return 'ALERTAR';
  if (!bajo && input.alertaActiva) return 'REARMAR';
  return 'NADA';
}

export interface HighUsageInput {
  /** Salidas por ventas de los últimos 7 días (unidad base, positivo). */
  consumoUltimos7Base: number;
  /** Salidas por ventas de las 4 semanas anteriores en total (unidad base, positivo). */
  consumoPrevias4SemBase: number;
  ultimaAlertaAt: Date | null | undefined;
  now: Date;
}

export function promedioSemanalPrevio(consumoPrevias4SemBase: number): number {
  return consumoPrevias4SemBase / 4;
}

// Sin historial previo no hay con qué comparar, así que no se alerta.
export function decideHighUsage(input: HighUsageInput): boolean {
  const promedio = promedioSemanalPrevio(input.consumoPrevias4SemBase);
  if (promedio <= 0) return false;
  if (input.consumoUltimos7Base <= promedio * CONSUMO_ALTO_FACTOR) return false;
  if (input.ultimaAlertaAt) {
    const dias = (input.now.getTime() - input.ultimaAlertaAt.getTime()) / 86_400_000;
    if (dias < CONSUMO_ALTO_DIAS_ENTRE_ALERTAS) return false;
  }
  return true;
}
