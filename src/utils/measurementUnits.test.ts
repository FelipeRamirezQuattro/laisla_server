import { describe, expect, it } from 'vitest';
import {
  areCompatibleUnits,
  calcConvertedCost,
  fromBaseQuantity,
  normalizeMeasurementUnit,
  pricePerBaseUnit,
  toBaseQuantity
} from './measurementUnits';

describe('measurementUnits', () => {
  it.each([
    [' kilos ', 'KG'],
    ['g', 'GR'],
    ['litros', 'LT'],
    ['mililitro', 'ML'],
    ['packs', 'PAQ'],
    ['unknown', 'UND']
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeMeasurementUnit(input)).toBe(expected);
  });

  it('converts kilograms and liters to base units and back', () => {
    expect(toBaseQuantity(1.5, 'KG')).toBe(1500);
    expect(toBaseQuantity(2, 'LT')).toBe(2000);
    expect(fromBaseQuantity(750, 'KG')).toBe(0.75);
    expect(fromBaseQuantity(500, 'LT')).toBe(0.5);
  });

  it('recognizes compatible unit families', () => {
    expect(areCompatibleUnits('KG', 'GR')).toBe(true);
    expect(areCompatibleUnits('LT', 'ML')).toBe(true);
    expect(areCompatibleUnits('UND', 'PAQ')).toBe(true);
    expect(areCompatibleUnits('KG', 'ML')).toBe(false);
  });

  it('calculates unit and converted costs', () => {
    expect(pricePerBaseUnit(24_000, 2, 'KG')).toBe(12);
    expect(calcConvertedCost({
      quantity: 250,
      unit: 'GR',
      totalPrice: 24_000,
      pricedQuantity: 2,
      pricedUnit: 'KG'
    })).toBe(3_000);
  });

  it('returns zero for invalid quantities or incompatible families', () => {
    expect(pricePerBaseUnit(10_000, 0, 'KG')).toBe(0);
    expect(calcConvertedCost({
      quantity: 250,
      unit: 'ML',
      totalPrice: 24_000,
      pricedQuantity: 2,
      pricedUnit: 'KG'
    })).toBe(0);
  });
});
