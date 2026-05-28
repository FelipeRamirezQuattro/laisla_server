import { Response } from 'express';
import { AuthRequest } from '../../types';
import DisposablePack from '../models/DisposablePack';
import Insumo from '../../inventario/models/Insumo';
import { calcConvertedCost } from '../../utils/measurementUnits';

async function recalcPackCosts(pack: InstanceType<typeof DisposablePack>): Promise<void> {
  for (const item of pack.items) {
    const insumo = await Insumo.findById(item.rawMaterialId);
    item.cost = insumo ? calcConvertedCost({
      quantity: item.quantity,
      unit: item.unit,
      totalPrice: insumo.precioLista,
      pricedQuantity: insumo.cantidadPresentacion,
      pricedUnit: insumo.unidad,
    }) : 0;
  }
  pack.totalCost = pack.items.reduce((s, i) => s + i.cost, 0);
}

export async function getDisposablePacks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const packs = await DisposablePack.find().sort({ name: 1 });
    res.json(packs);
  } catch {
    res.status(500).json({ error: 'Error al obtener packs' });
  }
}

export async function createDisposablePack(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pack = new DisposablePack(req.body);
    await recalcPackCosts(pack);
    await pack.save();
    res.status(201).json(pack);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear pack', details: String(err) });
  }
}

export async function updateDisposablePack(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pack = await DisposablePack.findById(req.params.id);
    if (!pack) { res.status(404).json({ error: 'Pack no encontrado' }); return; }
    Object.assign(pack, req.body);
    await recalcPackCosts(pack);
    await pack.save();
    res.json(pack);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar pack', details: String(err) });
  }
}
