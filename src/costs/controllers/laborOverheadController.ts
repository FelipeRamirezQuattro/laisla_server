import { Response } from 'express';
import { AuthRequest } from '../../types';
import LaborAndOverheadParams from '../models/LaborAndOverheadParams';
import { calcMOD, calcGIF } from '../services/CostCalculationService';
import { onParamsUpdated, previewParamsCascade } from '../services/CascadeUpdateService';

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

    Object.assign(params, req.body);

    const mod = calcMOD({
      hourlyWage: params.hourlyWage,
      numberOfWorkers: params.numberOfWorkers,
      hoursPerDay: params.hoursPerDay,
      numberOfShifts: params.numberOfShifts,
      monthlyCustomers: params.monthlyCustomers,
      productsPerCustomer: params.productsPerCustomer,
    });
    Object.assign(params, mod);

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
