import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { deleteTableZone, getTables } from './tableController';

const {
  countTables,
  findTables,
  findOrders,
  findReservations,
  findZoneById,
  findZoneByIdAndDelete,
} = vi.hoisted(() => ({
  countTables: vi.fn(),
  findTables: vi.fn(),
  findOrders: vi.fn(),
  findReservations: vi.fn(),
  findZoneById: vi.fn(),
  findZoneByIdAndDelete: vi.fn(),
}));

vi.mock('../models/Table', () => ({
  default: {
    countDocuments: countTables,
    find: findTables,
  },
}));

vi.mock('../models/Order', () => ({
  default: { find: findOrders, updateMany: vi.fn() },
}));

vi.mock('../models/Reservation', () => ({
  default: { find: findReservations },
}));

vi.mock('../models/TableZone', () => ({
  DEFAULT_TABLE_ZONES: [],
  default: {
    findById: findZoneById,
    findByIdAndDelete: findZoneByIdAndDelete,
  },
}));

function responseMock() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

describe('deleteTableZone', () => {
  beforeEach(() => {
    countTables.mockReset();
    findZoneById.mockReset();
    findZoneByIdAndDelete.mockReset();
  });

  it('deletes an empty table zone', async () => {
    countTables.mockResolvedValue(0);
    findZoneById.mockResolvedValue({ _id: 'zone-1', value: 'zone-value', label: 'QA vacía' });
    findZoneByIdAndDelete.mockResolvedValue({ _id: 'zone-1', label: 'QA vacía' });
    const response = responseMock();

    await deleteTableZone({ params: { id: 'zone-1' } } as unknown as Request, response);

    expect(countTables).toHaveBeenCalledWith({ zone: 'zone-value' });
    expect(findZoneByIdAndDelete).toHaveBeenCalledWith('zone-1');
    expect(response.json).toHaveBeenCalledWith({ message: 'Zona eliminada' });
  });
});

describe('getTables', () => {
  it('checks reservations for the selected date and time', async () => {
    const tableQuery = {
      sort: vi.fn(),
      lean: vi.fn().mockResolvedValue([]),
    };
    tableQuery.sort.mockReturnValue(tableQuery);
    const emptyRelatedQuery = {
      select: vi.fn(),
      lean: vi.fn().mockResolvedValue([]),
    };
    emptyRelatedQuery.select.mockReturnValue(emptyRelatedQuery);
    findTables.mockReturnValue(tableQuery);
    findOrders.mockReturnValue(emptyRelatedQuery);
    findReservations.mockReturnValue(emptyRelatedQuery);
    const response = responseMock();

    await getTables({
      query: { date: '2026-09-29', timeSlot: '19:00' },
    } as unknown as Request, response);

    expect(findReservations).toHaveBeenCalledWith(expect.objectContaining({
      timeSlot: '19:00',
    }));
    expect(response.json).toHaveBeenCalledWith([]);
  });
});
