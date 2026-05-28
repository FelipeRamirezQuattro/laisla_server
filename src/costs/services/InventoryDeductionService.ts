import mongoose from 'mongoose';
import Product from '../../models/Product';
import Recipe from '../models/Recipe';
import DisposablePack from '../models/DisposablePack';
import Insumo from '../../inventario/models/Insumo';
import InsumoStockMovement from '../../inventario/models/InsumoStockMovement';
import { fromBaseQuantity, normalizeMeasurementUnit, toBaseQuantity } from '../../utils/measurementUnits';

interface OrderItem {
  productId: mongoose.Types.ObjectId | string;
  quantity: number;
  productType?: 'product' | 'recipe';
  variantSize?: string;
}

type AggregatedConsumption = {
  insumoId: string;
  cantidadBase: number;
  unidad: ReturnType<typeof normalizeMeasurementUnit>;
};

function addConsumption(
  map: Map<string, AggregatedConsumption>,
  insumoId: mongoose.Types.ObjectId | string,
  quantity: number,
  unit: string
) {
  const key = String(insumoId);
  const normalizedUnit = normalizeMeasurementUnit(unit);
  const current = map.get(key);
  const cantidadBase = toBaseQuantity(quantity, normalizedUnit);
  if (current) {
    current.cantidadBase += cantidadBase;
    return;
  }
  map.set(key, { insumoId: key, cantidadBase, unidad: normalizedUnit });
}

async function collectRecipeConsumption(
  recipeId: mongoose.Types.ObjectId | string,
  variantSize: string | undefined,
  multiplier: number,
  map: Map<string, AggregatedConsumption>,
  visited: Set<string>
): Promise<void> {
  const recipe = await Recipe.findById(recipeId).lean();
  if (!recipe || recipe.variants.length === 0) return;

  const visitKey = `${recipe._id}:${variantSize ?? recipe.variants[0].size}`;
  if (visited.has(visitKey)) return;
  visited.add(visitKey);

  const variant = recipe.variants.find((entry) => entry.size === variantSize) ?? recipe.variants[0];

  for (const ing of variant.ingredients) {
    const quantity = ing.quantity * multiplier;
    if (ing.ingredientType === 'raw') {
      addConsumption(map, ing.ingredientRefId, quantity, ing.unit);
      continue;
    }

    await collectRecipeConsumption(ing.ingredientRefId, undefined, quantity, map, visited);
  }

  if (variant.disposablePackId) {
    const pack = await DisposablePack.findById(variant.disposablePackId).lean();
    for (const item of pack?.items ?? []) {
      addConsumption(map, item.rawMaterialId, item.quantity * multiplier, item.unit);
    }
  }

  visited.delete(visitKey);
}

export async function deductFromOrder(
  orderId: mongoose.Types.ObjectId | string,
  items: OrderItem[]
): Promise<number> {
  const existing = await InsumoStockMovement.countDocuments({
    orderId,
    tipo: 'VENTA_AUTOMATICA',
  });
  if (existing > 0) return 0;

  const consumptions = new Map<string, AggregatedConsumption>();
  for (const item of items) {
    const recipeId = item.productType === 'recipe'
      ? item.productId
      : (await Product.findById(item.productId).lean() as any)?.recipeId;
    if (!recipeId) continue;

    await collectRecipeConsumption(recipeId, item.variantSize, item.quantity, consumptions, new Set());
  }

  const insumos = await Insumo.find({ _id: { $in: [...consumptions.keys()] } }).lean();
  const insumoMap = new Map(insumos.map((insumo) => [String(insumo._id), insumo]));
  const docs = [...consumptions.values()]
    .filter((entry) => insumoMap.has(entry.insumoId) && entry.cantidadBase > 0)
    .map((entry) => {
      const insumo = insumoMap.get(entry.insumoId)!;
      const unidad = normalizeMeasurementUnit(insumo.unidad);
      return {
        insumoId: entry.insumoId,
        tipo: 'VENTA_AUTOMATICA',
        estado: 'PENDIENTE',
        cantidad: fromBaseQuantity(entry.cantidadBase, unidad),
        unidad,
        cantidadBase: -Math.abs(entry.cantidadBase),
        fecha: new Date(),
        orderId,
        notas: 'Consumo automático generado al facturar pedido',
      };
    });

  if (!docs.length) return 0;
  await InsumoStockMovement.insertMany(docs);
  return docs.length;
}
