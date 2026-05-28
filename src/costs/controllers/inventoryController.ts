import { Response } from 'express';
import { AuthRequest } from '../../types';
import InventoryMovement from '../models/InventoryMovement';
import RawMaterial from '../models/RawMaterial';
import { getISOWeek } from 'date-fns';

export async function getCurrentInventory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const materials = await RawMaterial.find().sort({ name: 1 }).lean();
    const result = await Promise.all(
      materials.map(async (mat) => {
        const latest = await InventoryMovement.findOne({ rawMaterialId: mat._id })
          .sort({ period: -1 })
          .lean();
        return {
          rawMaterial: mat,
          closingStock: latest?.closingStock ?? 0,
          unit: latest?.unit ?? mat.purchaseUnit,
          belowMin: (latest?.closingStock ?? 0) < mat.minStock,
          lastPeriod: latest?.period ?? null,
        };
      })
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
}

export async function getInventoryHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { rawMaterialId } = req.params;
    const movements = await InventoryMovement.find({ rawMaterialId })
      .sort({ period: -1 })
      .limit(52)
      .lean();
    res.json(movements);
  } catch {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
}

export async function createMovement(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { rawMaterialId, purchases, consumed, period } = req.body;
    const now = period ? new Date(period) : new Date();
    const weekNumber = getISOWeek(now);

    const prev = await InventoryMovement.findOne({ rawMaterialId }).sort({ period: -1 }).lean();
    const openingStock = prev?.closingStock ?? 0;

    const movement = await InventoryMovement.create({
      rawMaterialId,
      period: now,
      weekNumber,
      openingStock,
      purchases: purchases ?? 0,
      consumed: consumed ?? 0,
      unit: req.body.unit,
    });
    res.status(201).json(movement);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar movimiento', details: String(err) });
  }
}

export async function getInventoryAlerts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const materials = await RawMaterial.find({ minStock: { $gt: 0 } }).lean();
    const alerts = [];
    for (const mat of materials) {
      const latest = await InventoryMovement.findOne({ rawMaterialId: mat._id })
        .sort({ period: -1 })
        .lean();
      const stock = latest?.closingStock ?? 0;
      if (stock < mat.minStock) {
        alerts.push({ rawMaterial: mat, closingStock: stock, minStock: mat.minStock });
      }
    }
    res.json(alerts);
  } catch {
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
}

export async function getReorderReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const materials = await RawMaterial.find().lean();
    const report = [];
    for (const mat of materials) {
      const recentMovements = await InventoryMovement.find({ rawMaterialId: mat._id })
        .sort({ period: -1 })
        .limit(4)
        .lean();
      const avgConsumed =
        recentMovements.length > 0
          ? recentMovements.reduce((s, m) => s + m.consumed, 0) / recentMovements.length
          : 0;
      const latest = recentMovements[0];
      const stock = latest?.closingStock ?? 0;
      if (stock < mat.minStock) {
        report.push({
          rawMaterial: mat,
          closingStock: stock,
          minStock: mat.minStock,
          avgWeeklyConsumed: avgConsumed,
          weeksRemaining: avgConsumed > 0 ? stock / avgConsumed : null,
        });
      }
    }
    res.json(report);
  } catch {
    res.status(500).json({ error: 'Error al generar reporte' });
  }
}
