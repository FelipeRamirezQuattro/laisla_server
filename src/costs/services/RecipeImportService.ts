// Pure parsing/validation for the "importar recetas-producto" Excel flow. The
// frontend reads the .xlsx and sends canonical-keyed rows; everything that can
// be decided without the DB lives here so it is unit-tested directly.
import { VARIANT_SIZES } from '../models/Recipe';

export const MAX_IMPORT_ROWS = 500;

export interface RecipeImportRow {
  fila?: number;
  nombre?: unknown;
  categoria?: unknown;
  descripcion?: unknown;
  tamano?: unknown;
  precio_venta?: unknown;
  impuesto?: unknown;
  tiempo_preparacion_min?: unknown;
  activo?: unknown;
}

export interface ParsedVariant {
  size: string;
  salePrice: number;
  taxType: 'NONE' | 'IVA_19' | 'CONSUMO_8';
  taxRate: number;
}

export interface ParsedRecipe {
  name: string;
  categoryLabel: string;
  description: string;
  preparationTimeMinutes: number;
  active: boolean;
  variants: ParsedVariant[];
}

export interface RowError {
  row: number;
  message: string;
}

export const normalizeCategoryValue = (label: string) =>
  label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

// Case/accent/space-insensitive key used to detect the same recipe name.
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function parseSize(value: unknown): string | null {
  const raw = text(value).toUpperCase().replace(/\s+/g, '');
  if (!raw) return null;
  if (raw === 'UNIDAD' || raw === 'UN' || raw === 'U') return 'UND';
  const size = raw.replace(/ONZAS?$/, 'OZ');
  return (VARIANT_SIZES as readonly string[]).includes(size) ? size : null;
}

export function parseTax(value: unknown): Pick<ParsedVariant, 'taxType' | 'taxRate'> | null {
  const raw = text(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s%]/g, '');
  if (!raw) return null;
  if (['iva19', 'iva', '19', '0.19', '0,19'].includes(raw)) return { taxType: 'IVA_19', taxRate: 0.19 };
  if (['impoconsumo8', 'impoconsumo', 'consumo', 'consumo8', '8', '0.08', '0,08'].includes(raw)) {
    return { taxType: 'CONSUMO_8', taxRate: 0.08 };
  }
  if (['sinimpuesto', 'ninguno', 'noaplica', 'none', 'no', '0'].includes(raw)) return { taxType: 'NONE', taxRate: 0 };
  return null;
}

// Excel normally hands us a number; strings come from hand-typed cells ("$8.500").
export function parsePrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let raw = text(value).replace(/[$\s]/g, '');
  if (!raw) return null;
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) raw = raw.replace(/[.,]/g, '');
  else raw = raw.replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseActive(value: unknown): boolean {
  const raw = text(value).toLowerCase();
  return !['no', 'false', '0', 'inactivo'].includes(raw);
}

export function parseAndGroup(rows: RecipeImportRow[]): { recipes: ParsedRecipe[]; errors: RowError[] } {
  const errors: RowError[] = [];
  const badNames = new Set<string>();
  const groups = new Map<string, ParsedRecipe & { rows: number[] }>();

  rows.forEach((row, index) => {
    const rowNumber = row.fila ?? index + 2;
    const fail = (message: string) => {
      errors.push({ row: rowNumber, message });
      const key = nameKey(text(row.nombre));
      if (key) badNames.add(key);
    };

    const name = text(row.nombre).replace(/\s+/g, ' ');
    if (!name) return void errors.push({ row: rowNumber, message: 'Falta el nombre' });
    const categoryLabel = text(row.categoria);
    if (!categoryLabel) return fail('Falta la categoría');

    const size = parseSize(row.tamano);
    if (!size) return fail(`Tamaño inválido "${text(row.tamano)}". Usa: ${VARIANT_SIZES.join(', ')}`);

    const price = parsePrice(row.precio_venta);
    if (price === null || price <= 0) return fail('El precio de venta debe ser un número mayor a 0');

    const tax = parseTax(row.impuesto);
    if (!tax) return fail(`Impuesto inválido "${text(row.impuesto)}". Usa: IVA 19%, Impoconsumo 8% o Sin impuesto`);

    const minutesRaw = text(row.tiempo_preparacion_min);
    const minutes = minutesRaw ? Number(minutesRaw.replace(',', '.')) : 0;
    if (!Number.isFinite(minutes) || minutes < 0) return fail('El tiempo de preparación debe ser un número mayor o igual a 0');

    const key = nameKey(name);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        name,
        categoryLabel,
        description: text(row.descripcion),
        preparationTimeMinutes: minutes,
        active: parseActive(row.activo),
        variants: [{ size, salePrice: price, ...tax }],
        rows: [rowNumber],
      });
      return;
    }
    if (normalizeCategoryValue(existing.categoryLabel) !== normalizeCategoryValue(categoryLabel)) {
      return fail(`"${name}" aparece con otra categoría ("${existing.categoryLabel}" y "${categoryLabel}")`);
    }
    if (existing.variants.some((v) => v.size === size)) {
      return fail(`"${name}" repite el tamaño ${size}`);
    }
    existing.variants.push({ size, salePrice: price, ...tax });
    existing.rows.push(rowNumber);
    if (!existing.description) existing.description = text(row.descripcion);
    if (!existing.preparationTimeMinutes) existing.preparationTimeMinutes = minutes;
  });

  // A recipe with any invalid row is dropped whole, so nothing is created half-way.
  const recipes = [...groups.entries()]
    .filter(([key]) => !badNames.has(key))
    .map(([, group]) => {
      const { rows: _rows, ...recipe } = group;
      return recipe;
    });
  return { recipes, errors: errors.sort((a, b) => a.row - b.row) };
}
