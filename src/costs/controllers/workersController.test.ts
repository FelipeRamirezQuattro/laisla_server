import { describe, expect, it } from 'vitest';
import { pickEditableWorkerFields } from './workersController';

describe('pickEditableWorkerFields', () => {
  it('descarta campos que no se pueden editar', () => {
    expect(pickEditableWorkerFields({ name: 'Ana', hourlyRate: 5000, _id: 'x', createdAt: 'y', foo: 1 })).toEqual({ name: 'Ana', hourlyRate: 5000 });
  });
  it('conserva false/0 pero ignora lo no enviado', () => {
    expect(pickEditableWorkerFields({ active: false, hourlyRate: 0 })).toEqual({ active: false, hourlyRate: 0 });
  });
});

import { pickEditableParamFields } from './laborOverheadController';

describe('pickEditableParamFields', () => {
  it('ignora los campos derivados que calcula el servidor', () => {
    expect(
      pickEditableParamFields({ monthlyCustomers: 600, laborPerItem: 999, dailyLabor: 1, overheadItems: [], baselineMonth: '2026-10' })
    ).toEqual({ monthlyCustomers: 600, overheadItems: [], baselineMonth: '2026-10' });
  });
});
