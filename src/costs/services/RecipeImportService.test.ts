import { describe, it, expect } from 'vitest';
import { parseAndGroup, parsePrice, parseSize, parseTax, nameKey } from './RecipeImportService';

describe('parsers', () => {
  it('tamaño', () => {
    expect(parseSize('12 oz')).toBe('12OZ');
    expect(parseSize('unidad')).toBe('UND');
    expect(parseSize('XL')).toBeNull();
  });
  it('impuesto', () => {
    expect(parseTax('IVA 19%')).toEqual({ taxType: 'IVA_19', taxRate: 0.19 });
    expect(parseTax('Impoconsumo 8%')).toEqual({ taxType: 'CONSUMO_8', taxRate: 0.08 });
    expect(parseTax('Sin impuesto')).toEqual({ taxType: 'NONE', taxRate: 0 });
    expect(parseTax('otro')).toBeNull();
    expect(parseTax('')).toBeNull();
  });
  it('precio', () => {
    expect(parsePrice(8500)).toBe(8500);
    expect(parsePrice('$8.500')).toBe(8500);
    expect(parsePrice('8500,5')).toBe(8500.5);
    expect(parsePrice('abc')).toBeNull();
  });
  it('nameKey ignora mayúsculas, tildes y espacios', () => {
    expect(nameKey('  Café   Latte ')).toBe(nameKey('cafe latte'));
  });
});

describe('parseAndGroup', () => {
  const row = (o: Record<string, unknown>) => ({ nombre: 'Latte', categoria: 'Café caliente', tamano: '8OZ', precio_venta: 7000, impuesto: 'IVA 19%', ...o });

  it('agrupa filas del mismo nombre como variantes de una receta', () => {
    const { recipes, errors } = parseAndGroup([row({}), row({ tamano: '12OZ', precio_venta: 9000 }), row({ nombre: 'Waffle', categoria: 'Waffle', tamano: 'UND', precio_venta: 12000, impuesto: 'Sin impuesto' })]);
    expect(errors).toEqual([]);
    expect(recipes).toHaveLength(2);
    expect(recipes[0].variants.map((v) => v.size)).toEqual(['8OZ', '12OZ']);
    expect(recipes[1].variants[0]).toMatchObject({ taxType: 'NONE', taxRate: 0 });
  });

  it('reporta errores por fila y descarta la receta completa', () => {
    const { recipes, errors } = parseAndGroup([row({ fila: 2 }), row({ fila: 3, tamano: 'XL' }), row({ fila: 4, nombre: 'Chai', categoria: 'Chai', tamano: '8OZ' })]);
    expect(errors).toEqual([{ row: 3, message: expect.stringContaining('Tamaño inválido') }]);
    expect(recipes.map((r) => r.name)).toEqual(['Chai']);
  });

  it('detecta tamaño repetido y categorías contradictorias', () => {
    const { errors } = parseAndGroup([row({ fila: 2 }), row({ fila: 3 }), row({ fila: 4, tamano: '12OZ', categoria: 'Matcha' })]);
    expect(errors.map((e) => e.row)).toEqual([3, 4]);
  });

  it('valida faltantes y precio', () => {
    const { errors } = parseAndGroup([{ fila: 2 }, row({ fila: 3, nombre: 'A', categoria: '' }), row({ fila: 4, nombre: 'B', precio_venta: 0 })]);
    expect(errors.map((e) => e.row)).toEqual([2, 3, 4]);
  });
});
