import mongoose from 'mongoose';
import { env } from '../../config/env';
import InsumoCategoria from '../models/InsumoCategoria';
import Insumo from '../models/Insumo';

const b = (b: string, r: string, a: string) => ({ nivelBueno: b, nivelRegular: r, nivelAgotado: a });

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB');

  await InsumoCategoria.deleteMany({});
  await Insumo.deleteMany({});

  const [barra, caja, cocina] = await InsumoCategoria.insertMany([
    { nombre: 'INSUMOS BARRA', orden: 1 },
    { nombre: 'INSUMOS CAJA', orden: 2 },
    { nombre: 'INSUMOS COCINA', orden: 3 },
  ]);

  // ── INSUMOS BARRA ─────────────────────────────────────────────────────────
  await Insumo.insertMany([
    { nombre: 'HELADO MENTA CHIPS', categoriaId: barra._id, unidad: 'unidades', orden: 1 },
    { nombre: 'HELADOS VAINILLA', categoriaId: barra._id, unidad: 'unidades', orden: 2 },
    { nombre: 'HELADOS CHOCOLATE', categoriaId: barra._id, unidad: 'unidades', orden: 3 },
    { nombre: 'HELADO PASAS AL RON', categoriaId: barra._id, unidad: 'unidades', orden: 4 },
    { nombre: 'HELADOS YOGURTH CHERRI', categoriaId: barra._id, unidad: 'unidades', orden: 5 },
    { nombre: 'HELADOS FRAMBUESA', categoriaId: barra._id, unidad: 'unidades', orden: 6 },
    { nombre: 'HELADOS WICKED', categoriaId: barra._id, unidad: 'unidades', orden: 7 },
    { nombre: 'HELADOS COOKIES AND CREAM', categoriaId: barra._id, unidad: 'unidades', orden: 8 },
    { nombre: 'HELADOS SNICKERS', categoriaId: barra._id, unidad: 'unidades', orden: 9 },
    { nombre: 'HELADOS MANGO MARACUYA', categoriaId: barra._id, unidad: 'unidades', orden: 10 },
    { nombre: 'MACARRONS', categoriaId: barra._id, unidad: 'unidades', orden: 11, ...b('72 - 49 un.', '48 - 25 un.', '24 - 12 un.') },
    { nombre: 'MUFFINS', categoriaId: barra._id, unidad: 'unidades', orden: 12, ...b('30 - 16 un.', '15 - 10 un.', '10 - 6 un.') },
    { nombre: 'DONAS', categoriaId: barra._id, unidad: 'unidades', orden: 13, ...b('150 un', '50', '20 un') },
    { nombre: 'MEDIAS LUNAS', categoriaId: barra._id, unidad: 'unidades', orden: 14 },
    { nombre: 'PAN CHOCOLATE', categoriaId: barra._id, unidad: 'unidades', orden: 15 },
    { nombre: 'TORTA CHOCOLATE', categoriaId: barra._id, unidad: 'porciones', orden: 16, ...b('48 - 25 porciones', '24 - 13 porciones', '12 porciones') },
    { nombre: 'TORTA HOJA', categoriaId: barra._id, unidad: 'porciones', orden: 17 },
    { nombre: 'TORTA RED VELVET', categoriaId: barra._id, unidad: 'porciones', orden: 18 },
    { nombre: 'TORTA ZANAHORIA', categoriaId: barra._id, unidad: 'porciones', orden: 19 },
    { nombre: 'CHEESCAKE', categoriaId: barra._id, unidad: 'porciones', orden: 20, ...b('16 - 9 porciones', '8 - 5 porciones', '4 - 2 porciones') },
    { nombre: 'PIE DE LIMON', categoriaId: barra._id, unidad: 'porciones', orden: 21, ...b('24 - 17 porciones', '16 - 8 porciones', '7 - 2 porciones') },
    { nombre: 'CAFE EN GRANO KG.', categoriaId: barra._id, unidad: 'kilos', orden: 22, ...b('30 - 20 kls', '19 - 10 kls', '9 - 1 kl') },
    { nombre: 'CAFE EN GRANO BOLSITA', categoriaId: barra._id, unidad: 'unidades', orden: 23, ...b('20 - 11 un.', '10 - 7 un.', '6 un.') },
    { nombre: 'TE EN BOLSITA', categoriaId: barra._id, unidad: 'unidades', orden: 24, ...b('50 - 21 un.', '20 - 10 un.', '9 un.') },
    { nombre: 'SYRUP VAINILLA', categoriaId: barra._id, unidad: 'botellas', orden: 25 },
    { nombre: 'SYRUP CARAMELO', categoriaId: barra._id, unidad: 'botellas', orden: 26 },
    { nombre: 'SYRUP IRISH CREAM', categoriaId: barra._id, unidad: 'botellas', orden: 27 },
    { nombre: 'SYRUP AVELLANA', categoriaId: barra._id, unidad: 'botellas', orden: 28 },
    { nombre: 'SYRUP MENTA', categoriaId: barra._id, unidad: 'botellas', orden: 29 },
    { nombre: 'SYRUP CHAI', categoriaId: barra._id, unidad: 'botellas', orden: 30 },
    { nombre: 'PORCIONES DE FRUTILLA', categoriaId: barra._id, unidad: 'kilos', orden: 31, ...b('73 - 21 kilos', '20 - 6 kilos', '5 kilos') },
    { nombre: 'PORCIONES FRAMBUESA', categoriaId: barra._id, unidad: 'kilos', orden: 32, ...b('40 - 21 kilos', '20 - 6 kilos', '5 kilos') },
    { nombre: 'PORCIONES ARANDANO', categoriaId: barra._id, unidad: 'kilos', orden: 33, ...b('30 - 16 kilos', '15 - 6 kilos', '5 kilos') },
    { nombre: 'PORCIONES SMOOTHIES', categoriaId: barra._id, unidad: 'porciones', orden: 34, ...b('30 - 15 porciones', '14 - 6 porciones', '5 porciones') },
    { nombre: 'LIMONES', categoriaId: barra._id, unidad: 'unidades', orden: 35, ...b('40 - 20 un.', '19 - 10 un.', '9 un.') },
    { nombre: 'MENTA', categoriaId: barra._id, unidad: 'unidades', orden: 36 },
    { nombre: 'CHOCOLATE CALIENTE', categoriaId: barra._id, unidad: 'kilos', orden: 37, ...b('30 - 15 kls', '14 - 6 kls', '5 - 3 kls') },
    { nombre: 'MARSHMELLOWS', categoriaId: barra._id, unidad: 'unidades', orden: 38 },
    { nombre: 'SALSA CHOCOLATE', categoriaId: barra._id, unidad: 'unidades', orden: 39 },
    { nombre: 'SALSA CARAMELO', categoriaId: barra._id, unidad: 'unidades', orden: 40 },
    { nombre: 'SALSA MANJAR', categoriaId: barra._id, unidad: 'unidades', orden: 41 },
    { nombre: 'SALSA FRUTILLA', categoriaId: barra._id, unidad: 'unidades', orden: 42 },
    { nombre: 'GINGER BEER', categoriaId: barra._id, unidad: 'unidades', orden: 43, ...b('20 - 10 un.', '9 - 5 un.', '4 - 2 un.') },
    { nombre: 'AGUA TONICA', categoriaId: barra._id, unidad: 'unidades', orden: 44, ...b('20 - 10 un.', '9 - 5 un.', '4 - 2 un.') },
    { nombre: 'AGUA SIN GAS', categoriaId: barra._id, unidad: 'unidades', orden: 45 },
    { nombre: 'AGUA CON GAS', categoriaId: barra._id, unidad: 'unidades', orden: 46 },
    { nombre: 'CONOS HELADO', categoriaId: barra._id, unidad: 'unidades', orden: 47 },
    { nombre: 'PAN CIABATTA', categoriaId: barra._id, unidad: 'unidades', orden: 48, ...b('250 - 100 un', '99 - 30 un', '29 un') },
    { nombre: 'PAN CROISSANT', categoriaId: barra._id, unidad: 'unidades', orden: 49, ...b('30 un', '15 un', '5 un') },
    { nombre: 'PAN MARRAQUETA', categoriaId: barra._id, unidad: 'unidades', orden: 50, ...b('50 un', '30 un', '15 un') },
    { nombre: 'MASA PIZZA INDIVIDUAL', categoriaId: barra._id, unidad: 'unidades', orden: 51, ...b('50 - 30 un.', '29 - 10 un.', '9 un.') },
    { nombre: 'MASA PIZZA FAMILIAR', categoriaId: barra._id, unidad: 'unidades', orden: 52, ...b('50 - 30 un.', '29 - 10 un.', '9 un.') },
    { nombre: 'JAMON', categoriaId: barra._id, unidad: 'unidades', orden: 53 },
    { nombre: 'QUESO LAMINADO', categoriaId: barra._id, unidad: 'unidades', orden: 54 },
    { nombre: 'QUESO CREMA', categoriaId: barra._id, unidad: 'unidades', orden: 55 },
    { nombre: 'SALAME', categoriaId: barra._id, unidad: 'unidades', orden: 56 },
    { nombre: 'LECHUGA', categoriaId: barra._id, unidad: 'unidades', orden: 57 },
    { nombre: 'TOMATE CHERRY', categoriaId: barra._id, unidad: 'unidades', orden: 58 },
    { nombre: 'POLLO', categoriaId: barra._id, unidad: 'unidades', orden: 59 },
    { nombre: 'SALMON', categoriaId: barra._id, unidad: 'unidades', orden: 60 },
    { nombre: 'PESTO', categoriaId: barra._id, unidad: 'unidades', orden: 61 },
    { nombre: 'LACTONESA', categoriaId: barra._id, unidad: 'unidades', orden: 62 },
    { nombre: 'MAYONESA', categoriaId: barra._id, unidad: 'unidades', orden: 63 },
    { nombre: 'SALSA TOMATE', categoriaId: barra._id, unidad: 'unidades', orden: 64 },
    { nombre: 'QUESO MANTECOSO', categoriaId: barra._id, unidad: 'unidades', orden: 65 },
    { nombre: 'CHAMPIÑONES', categoriaId: barra._id, unidad: 'unidades', orden: 66 },
    { nombre: 'MORRON', categoriaId: barra._id, unidad: 'unidades', orden: 67 },
    { nombre: 'LECHE ENTERA', categoriaId: barra._id, unidad: 'litros', orden: 68 },
    { nombre: 'LECHE SIN LACTOSA', categoriaId: barra._id, unidad: 'litros', orden: 69 },
    { nombre: 'LECHE DESCREMADA', categoriaId: barra._id, unidad: 'litros', orden: 70 },
    { nombre: 'LECHE VEGETAL', categoriaId: barra._id, unidad: 'litros', orden: 71 },
    { nombre: 'CREMA CHANTILLY', categoriaId: barra._id, unidad: 'unidades', orden: 72 },
    { nombre: 'CANELA', categoriaId: barra._id, unidad: 'unidades', orden: 73 },
    { nombre: 'GLASEADO ROLLITOS', categoriaId: barra._id, unidad: 'unidades', orden: 74 },
    { nombre: 'SAL', categoriaId: barra._id, unidad: 'unidades', orden: 75 },
    { nombre: 'OREGANO', categoriaId: barra._id, unidad: 'unidades', orden: 76 },
  ]);

  // ── INSUMOS CAJA ──────────────────────────────────────────────────────────
  await Insumo.insertMany([
    { nombre: 'ROLLITOS DE PAPEL', categoriaId: caja._id, unidad: 'unidades', orden: 1, ...b('40 - 20 un', '19 - 10 un', '9 un') },
    { nombre: 'PLUMONES DE PIZARRA', categoriaId: caja._id, unidad: 'unidades', orden: 2 },
    { nombre: 'LAPICES', categoriaId: caja._id, unidad: 'unidades', orden: 3 },
    { nombre: 'CINTA DE PAPEL', categoriaId: caja._id, unidad: 'unidades', orden: 4 },
  ]);

  // ── INSUMOS COCINA ────────────────────────────────────────────────────────
  await Insumo.insertMany([
    { nombre: 'ACEITE', categoriaId: cocina._id, unidad: 'unidades', orden: 1 },
    { nombre: 'ACEITE DE OLIVA', categoriaId: cocina._id, unidad: 'bidones', orden: 2, ...b('BIDÓN COMPLETO', 'MEDIO BIDÓN', '1/4 BIDÓN') },
    { nombre: 'PALTAS', categoriaId: cocina._id, unidad: 'unidades', orden: 3 },
    { nombre: 'PLATANO', categoriaId: cocina._id, unidad: 'unidades', orden: 4 },
    { nombre: 'FRUTILLAS', categoriaId: cocina._id, unidad: 'unidades', orden: 5 },
    { nombre: 'DURAZNO', categoriaId: cocina._id, unidad: 'unidades', orden: 6 },
    { nombre: 'MANZANA', categoriaId: cocina._id, unidad: 'unidades', orden: 7 },
    { nombre: 'NUECES', categoriaId: cocina._id, unidad: 'unidades', orden: 8 },
    { nombre: 'NARANJAS', categoriaId: cocina._id, unidad: 'unidades', orden: 9 },
    { nombre: 'SACHET MOSTAZA', categoriaId: cocina._id, unidad: 'sachets', orden: 10, ...b('500 sachets', '200 sachets', '100 sachets') },
    { nombre: 'SACHET KETCHUP', categoriaId: cocina._id, unidad: 'sachets', orden: 11, ...b('500 sachets', '200 sachets', '100 sachets') },
    { nombre: 'MASCARILLAS', categoriaId: cocina._id, unidad: 'unidades', orden: 12 },
    { nombre: 'COFIAS', categoriaId: cocina._id, unidad: 'unidades', orden: 13 },
    { nombre: 'GALLETA OREO', categoriaId: cocina._id, unidad: 'unidades', orden: 14 },
    { nombre: 'GALLETA MOLIDA', categoriaId: cocina._id, unidad: 'unidades', orden: 15 },
    { nombre: 'SACHET SAL', categoriaId: cocina._id, unidad: 'sachets', orden: 16 },
    { nombre: 'LEGUMBRES', categoriaId: cocina._id, unidad: 'paquetes', orden: 17, ...b('10 paquetes', '5 paq.', '2 paq.') },
    { nombre: 'ATUN', categoriaId: cocina._id, unidad: 'latas', orden: 18, ...b('10 latas', '5 latas', '2 latas') },
    { nombre: 'KIWI', categoriaId: cocina._id, unidad: 'unidades', orden: 19 },
    { nombre: 'MANTEQUILLAS', categoriaId: cocina._id, unidad: 'unidades', orden: 20, ...b('40 un.', '20 un.', '6 un.') },
    { nombre: 'CHOCOLATE PARA DERRETIR', categoriaId: cocina._id, unidad: 'kilos', orden: 21, ...b('3 kilos', '2 kilos', '1 kilo') },
    { nombre: 'CHIPS CHOCOLATE', categoriaId: cocina._id, unidad: 'kilos', orden: 22, ...b('3 kilos', '2 kilos', '1 kilo') },
    { nombre: 'CACAO AMARGO', categoriaId: cocina._id, unidad: 'bolsas', orden: 23, ...b('20 bolsas', '10 bolsas', '5 bolsas') },
    { nombre: 'LECHE CONDENSADA', categoriaId: cocina._id, unidad: 'latas', orden: 24, ...b('20 latas', '10 latas', '6 latas') },
    { nombre: 'GELATINA', categoriaId: cocina._id, unidad: 'paquetes', orden: 25, ...b('6 paquetes', '3 paq.', '1 paquete') },
    { nombre: 'PALMITOS', categoriaId: cocina._id, unidad: 'latas', orden: 26, ...b('10 latas', '5 latas', '2 latas') },
    { nombre: 'SALSA TERIYAKE', categoriaId: cocina._id, unidad: 'salsas', orden: 27, ...b('20 salsas', '10 salsas', '5 salsas') },
    { nombre: 'LECHE EVAPORADA', categoriaId: cocina._id, unidad: 'latas', orden: 28, ...b('10 latas', '5 latas', '2 latas') },
    { nombre: 'MERENGUE ITALIANO', categoriaId: cocina._id, unidad: 'unidades', orden: 29 },
    { nombre: 'ACEITUNAS', categoriaId: cocina._id, unidad: 'bolsas', orden: 30, ...b('5 bolsas', '3 bolsas', '1 bolsa') },
    { nombre: 'CREMA DE COCO', categoriaId: cocina._id, unidad: 'latas', orden: 31, ...b('10 latas', '5 latas', '2 latas') },
    { nombre: 'PIÑA', categoriaId: cocina._id, unidad: 'latas', orden: 32, ...b('10 latas', '5 latas', '2 latas') },
    { nombre: 'HUEVOS', categoriaId: cocina._id, unidad: 'bandejas', orden: 33, ...b('6 bandejas', '4 bandejas', '2 bandejas') },
    { nombre: 'TOCINO', categoriaId: cocina._id, unidad: 'paquetes', orden: 34, ...b('30 paquetes', '20 paquetes', '5 paquetes') },
    { nombre: 'CHOCLO', categoriaId: cocina._id, unidad: 'kilos', orden: 35, ...b('4 kilos', '2 kilos', '1 kilo') },
    { nombre: 'CHURRASCO DE VACUNO', categoriaId: cocina._id, unidad: 'churrascos', orden: 36, ...b('80 - 60 churrascos', '59 - 20 churrascos', '19 churrascos') },
    { nombre: 'HARINA', categoriaId: cocina._id, unidad: 'bolsas', orden: 37, ...b('BOLSA ENTERA', 'MEDIA BOLSA', '1/4 BOLSA') },
    { nombre: 'PAPAS HILO', categoriaId: cocina._id, unidad: 'bolsas', orden: 38, ...b('20 - 15 bolsas', '14 - 6 bolsas', '5 bolsas') },
    { nombre: 'PAPAS CHIPS', categoriaId: cocina._id, unidad: 'bolsas', orden: 39, ...b('20 - 15 bolsas', '14 - 6 bolsas', '5 bolsas') },
  ]);

  console.log('Seed completado: 3 categorías, 119 insumos');
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
