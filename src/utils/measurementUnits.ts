export type MeasurementUnit = 'KG' | 'GR' | 'LT' | 'ML' | 'UND' | 'PAQ';

export const MEASUREMENT_UNITS: MeasurementUnit[] = ['KG', 'GR', 'LT', 'ML', 'UND', 'PAQ'];

export const MEASUREMENT_UNIT_LABELS: Record<MeasurementUnit, string> = {
  KG: 'Kilogramos',
  GR: 'Gramos',
  LT: 'Litros',
  ML: 'Mililitros',
  UND: 'Unidades',
  PAQ: 'Paquetes',
};

type UnitFamily = 'weight' | 'volume' | 'count';

const UNIT_FAMILY: Record<MeasurementUnit, UnitFamily> = {
  KG: 'weight',
  GR: 'weight',
  LT: 'volume',
  ML: 'volume',
  UND: 'count',
  PAQ: 'count',
};

export function normalizeMeasurementUnit(unit?: string | null): MeasurementUnit {
  const value = String(unit ?? '').trim().toUpperCase();
  if (['KG', 'KILO', 'KILOS', 'KILOGRAMO', 'KILOGRAMOS'].includes(value)) return 'KG';
  if (['GR', 'G', 'GRAMO', 'GRAMOS'].includes(value)) return 'GR';
  if (['LT', 'L', 'LITRO', 'LITROS'].includes(value)) return 'LT';
  if (['ML', 'MILILITRO', 'MILILITROS'].includes(value)) return 'ML';
  if (['PAQ', 'PAQS', 'PAQUETE', 'PAQUETES', 'PACK', 'PACKS'].includes(value)) return 'PAQ';
  return 'UND';
}

export function toBaseQuantity(quantity: number, unit?: string | null): number {
  const normalized = normalizeMeasurementUnit(unit);
  if (normalized === 'KG' || normalized === 'LT') return quantity * 1000;
  return quantity;
}

export function fromBaseQuantity(quantity: number, unit?: string | null): number {
  const normalized = normalizeMeasurementUnit(unit);
  if (normalized === 'KG' || normalized === 'LT') return quantity / 1000;
  return quantity;
}

export function areCompatibleUnits(a?: string | null, b?: string | null): boolean {
  return UNIT_FAMILY[normalizeMeasurementUnit(a)] === UNIT_FAMILY[normalizeMeasurementUnit(b)];
}

export function pricePerBaseUnit(totalPrice: number, quantity: number, unit?: string | null): number {
  const baseQuantity = toBaseQuantity(quantity, unit);
  if (baseQuantity <= 0) return 0;
  return totalPrice / baseQuantity;
}

export function calcConvertedCost(input: {
  quantity: number;
  unit?: string | null;
  totalPrice?: number | null;
  pricedQuantity?: number | null;
  pricedUnit?: string | null;
}): number {
  const totalPrice = input.totalPrice ?? 0;
  if (!totalPrice || !areCompatibleUnits(input.unit, input.pricedUnit)) return 0;
  const baseQuantity = toBaseQuantity(input.quantity, input.unit);
  return baseQuantity * pricePerBaseUnit(totalPrice, input.pricedQuantity ?? 1, input.pricedUnit);
}
