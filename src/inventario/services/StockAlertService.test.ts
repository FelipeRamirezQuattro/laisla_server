import { describe, expect, it } from 'vitest';
import { decideHighUsage, decideStockLow } from './StockAlertService';

describe('decideStockLow', () => {
  it('alerta al cruzar el mínimo', () => {
    expect(decideStockLow({ stockBase: 900, stockMinimoBase: 1000, alertaActiva: false })).toBe('ALERTAR');
    expect(decideStockLow({ stockBase: 1000, stockMinimoBase: 1000, alertaActiva: false })).toBe('ALERTAR');
  });
  it('no repite mientras siga bajo', () => {
    expect(decideStockLow({ stockBase: 500, stockMinimoBase: 1000, alertaActiva: true })).toBe('NADA');
  });
  it('se rearma al reponer por encima del mínimo', () => {
    expect(decideStockLow({ stockBase: 5000, stockMinimoBase: 1000, alertaActiva: true })).toBe('REARMAR');
  });
  it('sin mínimo configurado no alerta (y limpia una bandera vieja)', () => {
    expect(decideStockLow({ stockBase: 0, stockMinimoBase: null, alertaActiva: false })).toBe('NADA');
    expect(decideStockLow({ stockBase: 0, stockMinimoBase: null, alertaActiva: true })).toBe('REARMAR');
  });
  it('stock sobre el mínimo no hace nada', () => {
    expect(decideStockLow({ stockBase: 5000, stockMinimoBase: 1000, alertaActiva: false })).toBe('NADA');
  });
});

describe('decideHighUsage', () => {
  const now = new Date('2026-03-15T12:00:00Z');
  it('alerta si la última semana supera 1,5× el promedio previo', () => {
    // promedio previo = 400/4 = 100; 7 días = 160 > 150
    expect(decideHighUsage({ consumoUltimos7Base: 160, consumoPrevias4SemBase: 400, ultimaAlertaAt: null, now })).toBe(true);
  });
  it('no alerta en el umbral ni por debajo', () => {
    expect(decideHighUsage({ consumoUltimos7Base: 150, consumoPrevias4SemBase: 400, ultimaAlertaAt: null, now })).toBe(false);
    expect(decideHighUsage({ consumoUltimos7Base: 90, consumoPrevias4SemBase: 400, ultimaAlertaAt: null, now })).toBe(false);
  });
  it('sin historial previo no hay base de comparación', () => {
    expect(decideHighUsage({ consumoUltimos7Base: 500, consumoPrevias4SemBase: 0, ultimaAlertaAt: null, now })).toBe(false);
  });
  it('no repite antes de 7 días', () => {
    const hace3 = new Date('2026-03-12T12:00:00Z');
    const hace8 = new Date('2026-03-07T12:00:00Z');
    expect(decideHighUsage({ consumoUltimos7Base: 160, consumoPrevias4SemBase: 400, ultimaAlertaAt: hace3, now })).toBe(false);
    expect(decideHighUsage({ consumoUltimos7Base: 160, consumoPrevias4SemBase: 400, ultimaAlertaAt: hace8, now })).toBe(true);
  });
});
