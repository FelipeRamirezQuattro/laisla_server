import { describe, expect, it } from 'vitest';
import { pickEditableInsumoFields } from './insumosController';

describe('pickEditableInsumoFields', () => {
  it('descarta campos que no son editables por el usuario', () => {
    const data = pickEditableInsumoFields({ nombre: 'Leche', alertaStockBajoActiva: true, ultimaAlertaConsumoAt: new Date(), _id: 'x' });
    expect(data).toEqual({ nombre: 'Leche' });
  });

  it('conserva null (limpiar un campo) pero ignora los no enviados', () => {
    const data = pickEditableInsumoFields({ precioLista: null, stockMinimo: 5 });
    expect(data).toEqual({ precioLista: null, stockMinimo: 5 });
  });

  it('limpia vidaUtilDias cuando el tipo ya no es VIDA_UTIL', () => {
    expect(pickEditableInsumoFields({ tipoVencimiento: 'FECHA', vidaUtilDias: 3 }).vidaUtilDias).toBeNull();
    expect(pickEditableInsumoFields({ tipoVencimiento: 'VIDA_UTIL', vidaUtilDias: 3 }).vidaUtilDias).toBe(3);
  });
});
