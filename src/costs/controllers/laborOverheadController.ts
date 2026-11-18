import { Response } from 'express';
import { AuthRequest } from '../../types';
import LaborAndOverheadParams from '../models/LaborAndOverheadParams';
import { calcGIF, resolveLabor } from '../services/CostCalculationService';
import { loadActiveWorkers } from '../services/WorkerService';
import { getMonthlySuggestion } from '../services/MonthlyBaselineOrchestration';
import { isValidMonth } from '../services/MonthlyBaselineService';
import { onParamsUpdated, previewParamsCascade } from '../services/CascadeUpdateService';

export const EDITABLE_PARAM_FIELDS = [
  'hourlyWage', 'numberOfWorkers', 'hoursPerDay', 'numberOfShifts',
  'monthlyCustomers', 'productsPerCustomer', 'overheadItems', 'ivaRate', 'baselineMonth',
] as const;

// Los campos derivados (dailyLabor, laborPerItem…) los calcula el servidor; el cliente no puede fijarlos.
export function pickEditableParamFields(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of EDITABLE_PARAM_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

export async function getParams(req: AuthRequest, res: Response): Promise<void> {
  try {
    let params = await LaborAndOverheadParams.findOne();
    if (!params) params = await LaborAndOverheadParams.create({});
    res.json(params);
  } catch {
    res.status(500).json({ error: 'Error al obtener parámetros' });
  }
}

export async function updateParams(req: AuthRequest, res: Response): Promise<void> {
  try {
    let params = await LaborAndOverheadParams.findOne();
    if (!params) params = new LaborAndOverheadParams();

    Object.assign(params, pickEditableParamFields(req.body));

    // Con trabajadores activos la mano de obra sale de ellos; sin trabajadores, de los campos manuales.
    const { totalHourlyWage, dailyLabor, monthlyLabor, laborPerItem } = resolveLabor(
      {
        hourlyWage: params.hourlyWage,
        numberOfWorkers: params.numberOfWorkers,
        hoursPerDay: params.hoursPerDay,
        numberOfShifts: params.numberOfShifts,
        monthlyCustomers: params.monthlyCustomers,
        productsPerCustomer: params.productsPerCustomer,
      },
      await loadActiveWorkers()
    );
    Object.assign(params, { totalHourlyWage, dailyLabor, monthlyLabor, laborPerItem });

    const gif = calcGIF({
      overheadItems: params.overheadItems,
      monthlyCustomers: params.monthlyCustomers,
      productsPerCustomer: params.productsPerCustomer,
    });
    Object.assign(params, gif);

    await params.save();
    await onParamsUpdated(req.user!.id);
    res.json(params);
  } catch (err) {
    if (err instanceof Error && err.name === 'ValidationError') {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Error al actualizar parámetros', details: String(err) });
  }
}

export async function cascadePreviewParams(req: AuthRequest, res: Response): Promise<void> {
  try {
    const preview = await previewParamsCascade();
    res.json(preview);
  } catch {
    res.status(500).json({ error: 'Error al calcular impacto' });
  }
}

// Sugerencia de clientes/mes, productos/cliente y GIF a partir de las ventas y gastos de un mes
// (por defecto el anterior). Solo calcula: no guarda nada; aplicarla es una acción del usuario.
export async function getSuggestion(req: AuthRequest, res: Response): Promise<void> {
  try {
    const month = req.query.month;
    if (month !== undefined && !isValidMonth(month)) {
      res.status(400).json({ error: 'Mes inválido: usa el formato yyyy-MM' });
      return;
    }
    res.json(await getMonthlySuggestion(month as string | undefined));
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular la sugerencia', details: String(err) });
  }
}
