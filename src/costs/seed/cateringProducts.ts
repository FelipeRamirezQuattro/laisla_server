// Catálogo Catering — Lovely Picnic Ibagué (PDF "Catering · Servicio de botanas
// para compartir"). Precios en COP por unidad, sin impuesto (decisión del
// negocio: el PDF no lo indica). Condiciones del pedido (mínimo 10 unidades por
// referencia, 3 días de anticipación, reserva del 50%) NO se guardan aquí.
import type { RecipeImportRow } from '../services/RecipeImportService';

const SALADAS = 'Botanitas saladas';
const DULCES = 'Botanitas dulces';

const product = (nombre: string, categoria: string, precio: number, descripcion: string): RecipeImportRow => ({
  nombre,
  categoria,
  descripcion,
  tamano: 'UND',
  precio_venta: precio,
  impuesto: 'Sin impuesto',
  activo: 'SI',
});

export const CATERING_PRODUCTS: RecipeImportRow[] = [
  product('Mini hamburguesas', SALADAS, 3500, 'Carne, queso, lechuga, tomate y salsa'),
  product('Mini perros', SALADAS, 3000, 'Salchicha, queso y salsas'),
  product('Mini sándwich', SALADAS, 2500, 'Jamón, queso, lechuga y salsa'),
  product('Mini empanadas', SALADAS, 1500, 'Carne y papa'),
  product('Canasticos de atún', SALADAS, 2500, 'Lechuga, ensalada de atún y tomate cherry'),
  product('Wrap de nugget', SALADAS, 3000, 'Lechuga, queso, nugget de pollo y salsa'),
  product('Pinchitos de nugget', SALADAS, 2000, 'Nugget de pollo'),
  product('Dip mexicano', SALADAS, 3500, 'Fríjol refrito, guacamole, pico de gallo y nacho'),
  product('Mini donas', DULCES, 2000, 'Recubiertas de chocolate'),
  product('Mini brownies', DULCES, 2000, 'Con cobertura de chocolate y arequipe'),
  product('Cheesecake', DULCES, 3000, 'Sabores: limón, oreo y frutos rojos'),
  product('Galletas de chocolate', DULCES, 1200, 'Con chips y cobertura'),
];
