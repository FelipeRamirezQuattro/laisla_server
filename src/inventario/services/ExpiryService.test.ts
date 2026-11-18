import { describe, expect, it } from 'vitest';
import { computeFechaVencimiento, ExpiryError } from './ExpiryService';

const compra = new Date('2026-03-10T05:00:00.000Z'); // 10-mar 00:00 Colombia

describe('computeFechaVencimiento', () => {
  it('no calcula nada para insumos que no vencen', () => {
    expect(computeFechaVencimiento({ tipoVencimiento: 'NINGUNO' }, compra)).toBeNull();
    expect(computeFechaVencimiento({}, compra, '2026-03-20')).toBeNull();
  });

  it('FECHA exige la fecha en cada compra', () => {
    expect(() => computeFechaVencimiento({ tipoVencimiento: 'FECHA' }, compra)).toThrow(ExpiryError);
    const f = computeFechaVencimiento({ tipoVencimiento: 'FECHA' }, compra, '2026-03-20')!;
    expect(f.toISOString()).toBe('2026-03-20T05:00:00.000Z');
  });

  it('VIDA_UTIL suma los días a la fecha de compra', () => {
    const f = computeFechaVencimiento({ tipoVencimiento: 'VIDA_UTIL', vidaUtilDias: 3 }, compra)!;
    expect(f.toISOString()).toBe('2026-03-13T05:00:00.000Z');
  });

  it('VIDA_UTIL permite una fecha explícita que reemplaza el cálculo', () => {
    const f = computeFechaVencimiento({ tipoVencimiento: 'VIDA_UTIL', vidaUtilDias: 3 }, compra, '2026-03-11')!;
    expect(f.toISOString()).toBe('2026-03-11T05:00:00.000Z');
  });

  it('VIDA_UTIL sin días configurados es un error claro', () => {
    expect(() => computeFechaVencimiento({ tipoVencimiento: 'VIDA_UTIL', vidaUtilDias: null }, compra)).toThrow(ExpiryError);
  });

  it('rechaza fechas inválidas', () => {
    expect(() => computeFechaVencimiento({ tipoVencimiento: 'FECHA' }, compra, 'no-es-fecha')).toThrow(ExpiryError);
  });
});

import { evaluarLotes, summarizeStock } from './ExpiryService';

describe('evaluarLotes (FIFO)', () => {
  const hoy = new Date('2026-03-15T05:00:00.000Z');
  const lote = (id: string, dia: number, cantidadBase: number, vence: string | null) => ({
    id,
    cantidadBase,
    fecha: new Date(`2026-03-${String(dia).padStart(2, '0')}T05:00:00.000Z`),
    fechaVencimiento: vence ? new Date(`${vence}T05:00:00.000Z`) : null,
  });

  it('si no se ha consumido nada, todo el lote vencido queda por descontar', () => {
    const r = evaluarLotes(10, [lote('a', 1, 10, '2026-03-10')], hoy);
    expect(r).toEqual([{ id: 'a', remanenteBase: 10, vencido: true }]);
  });

  it('el stock se asigna a los lotes más nuevos: el viejo vencido solo conserva lo que sobra', () => {
    // compró 10 el día 1 (vence 10) y 10 el día 8 (vence 20); quedan 12 → 10 del nuevo + 2 del viejo
    const r = evaluarLotes(12, [lote('viejo', 1, 10, '2026-03-10'), lote('nuevo', 8, 10, '2026-03-20')], hoy);
    expect(r.find((l) => l.id === 'nuevo')).toEqual({ id: 'nuevo', remanenteBase: 10, vencido: false });
    expect(r.find((l) => l.id === 'viejo')).toEqual({ id: 'viejo', remanenteBase: 2, vencido: true });
  });

  it('si ya se consumió todo lo del lote vencido, no hay nada que descontar', () => {
    const r = evaluarLotes(5, [lote('viejo', 1, 10, '2026-03-10'), lote('nuevo', 8, 10, '2026-03-20')], hoy);
    expect(r.find((l) => l.id === 'viejo')!.remanenteBase).toBe(0);
  });

  it('un lote que vence hoy todavía sirve (vence al día siguiente)', () => {
    const r = evaluarLotes(4, [lote('a', 10, 4, '2026-03-15')], hoy);
    expect(r[0].vencido).toBe(false);
  });

  it('stock negativo o cero no genera remanentes', () => {
    expect(evaluarLotes(-3, [lote('a', 1, 10, '2026-03-10')], hoy)[0].remanenteBase).toBe(0);
  });

  it('los lotes sin vencimiento ocupan existencia pero nunca vencen', () => {
    const r = evaluarLotes(10, [lote('viejo', 1, 10, '2026-03-10'), lote('sinFecha', 9, 10, null)], hoy);
    expect(r.find((l) => l.id === 'sinFecha')).toEqual({ id: 'sinFecha', remanenteBase: 10, vencido: false });
    expect(r.find((l) => l.id === 'viejo')!.remanenteBase).toBe(0);
  });
});

describe('summarizeStock', () => {
  it('suma lo aprobado y separa las salidas pendientes', () => {
    expect(
      summarizeStock([
        { estado: 'APROBADO', cantidadBase: 100 },
        { estado: 'APROBADO', cantidadBase: -30 },
        { estado: 'PENDIENTE', cantidadBase: -20 },
        { estado: 'PENDIENTE', cantidadBase: 5 },
        { estado: 'RECHAZADO', cantidadBase: -50 },
      ])
    ).toEqual({ stockBase: 70, pendingOutBase: 20 });
  });
});
