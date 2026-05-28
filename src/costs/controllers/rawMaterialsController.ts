import { Response } from 'express';
import { AuthRequest } from '../../types';
import RawMaterial from '../models/RawMaterial';
import DisposablePack from '../models/DisposablePack';
import Recipe from '../models/Recipe';
import { onRawMaterialUpdated, previewRawMaterialCascade } from '../services/CascadeUpdateService';
import { pricePerBaseUnit } from '../../utils/measurementUnits';

export async function getRawMaterials(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { category, search } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (search) filter.name = { $regex: search, $options: 'i' };
    const materials = await RawMaterial.find(filter).sort({ category: 1, name: 1 });
    res.json(materials);
  } catch {
    res.status(500).json({ error: 'Error al obtener insumos' });
  }
}

export async function getRawMaterial(req: AuthRequest, res: Response): Promise<void> {
  try {
    const material = await RawMaterial.findById(req.params.id);
    if (!material) { res.status(404).json({ error: 'Insumo no encontrado' }); return; }
    res.json(material);
  } catch {
    res.status(500).json({ error: 'Error al obtener insumo' });
  }
}

export async function createRawMaterial(req: AuthRequest, res: Response): Promise<void> {
  try {
    const material = await RawMaterial.create(req.body);
    res.status(201).json(material);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear insumo', details: String(err) });
  }
}

export async function updateRawMaterial(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { totalPrice, quantityPerPresentation, purchaseUnit } = req.body;
    const existing = await RawMaterial.findById(req.params.id);
    if (!existing) { res.status(404).json({ error: 'Insumo no encontrado' }); return; }

    Object.assign(existing, req.body);
    if (totalPrice !== undefined || quantityPerPresentation !== undefined || purchaseUnit !== undefined) {
      const qty = quantityPerPresentation ?? existing.quantityPerPresentation;
      const price = totalPrice ?? existing.totalPrice;
      existing.pricePerUnit = pricePerBaseUnit(price, qty, purchaseUnit ?? existing.purchaseUnit);
    }
    await existing.save();

    await onRawMaterialUpdated(req.params.id, req.user!.id);
    res.json(existing);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar insumo', details: String(err) });
  }
}

export async function deleteRawMaterial(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id;
    const usedInPack = await DisposablePack.findOne({ 'items.rawMaterialId': id });
    if (usedInPack) {
      res.status(409).json({
        error: `Insumo en uso en pack "${usedInPack.name}". Retíralo del pack primero.`,
      });
      return;
    }
    const usedInRecipe = await Recipe.findOne({
      'variants.ingredients.ingredientRefId': id,
      'variants.ingredients.ingredientType': 'raw',
    });
    if (usedInRecipe) {
      res.status(409).json({
        error: `Insumo en uso en receta "${usedInRecipe.name}". Retíralo de la receta primero.`,
      });
      return;
    }
    await RawMaterial.findByIdAndDelete(id);
    res.json({ message: 'Insumo eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar insumo' });
  }
}

export async function cascadePreviewRawMaterial(req: AuthRequest, res: Response): Promise<void> {
  try {
    const preview = await previewRawMaterialCascade(req.params.id);
    res.json(preview);
  } catch {
    res.status(500).json({ error: 'Error al calcular impacto' });
  }
}
