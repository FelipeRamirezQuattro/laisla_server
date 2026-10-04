import { Response } from 'express';
import { AuthRequest } from '../../types';
import PrintConfig from '../models/PrintConfig';

export async function getPrintConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    let config = await PrintConfig.findOne();
    if (!config) config = await PrintConfig.create({});
    res.json(config);
  } catch {
    res.status(500).json({ error: 'Error al obtener la configuración de impresión' });
  }
}

export async function updatePrintConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    let config = await PrintConfig.findOne();
    if (!config) config = new PrintConfig();
    Object.assign(config, req.body);
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar la configuración de impresión', details: String(err) });
  }
}
