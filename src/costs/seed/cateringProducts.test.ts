import { describe, it, expect } from 'vitest';
import { parseAndGroup } from '../services/RecipeImportService';
import { CATERING_PRODUCTS } from './cateringProducts';

describe('CATERING_PRODUCTS', () => {
  const { recipes, errors } = parseAndGroup(CATERING_PRODUCTS);

  it('es válido para el importador y no tiene errores', () => {
    expect(errors).toEqual([]);
    expect(recipes).toHaveLength(12);
  });

  it('8 saladas y 4 dulces, una variante UND sin impuesto', () => {
    expect(recipes.filter((r) => r.categoryLabel === 'Botanitas saladas')).toHaveLength(8);
    expect(recipes.filter((r) => r.categoryLabel === 'Botanitas dulces')).toHaveLength(4);
    for (const r of recipes) {
      expect(r.variants).toEqual([{ size: 'UND', salePrice: expect.any(Number), taxType: 'NONE', taxRate: 0 }]);
    }
  });

  it('conserva los precios del PDF', () => {
    const price = (name: string) => recipes.find((r) => r.name === name)!.variants[0].salePrice;
    expect(price('Mini hamburguesas')).toBe(3500);
    expect(price('Mini empanadas')).toBe(1500);
    expect(price('Cheesecake')).toBe(3000);
    expect(price('Galletas de chocolate')).toBe(1200);
  });
});
