import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createAdminReservation } from './reservationController';

const {
  findTableById,
  findOrder,
  findReservation,
  createReservation,
  findReservationById,
} = vi.hoisted(() => ({
  findTableById: vi.fn(),
  findOrder: vi.fn(),
  findReservation: vi.fn(),
  createReservation: vi.fn(),
  findReservationById: vi.fn(),
}));

vi.mock('../models/Table', () => ({
  default: { findById: findTableById },
}));

vi.mock('../models/Order', () => ({
  default: { findOne: findOrder },
}));

vi.mock('../models/Reservation', () => ({
  default: {
    findOne: findReservation,
    create: createReservation,
    findById: findReservationById,
  },
}));

vi.mock('../services/emailService', () => ({
  sendReservationReceivedEmail: vi.fn(),
  sendReservationConfirmedEmail: vi.fn(),
}));

function leanResult(value: unknown) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function responseMock() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

describe('createAdminReservation', () => {
  beforeEach(() => {
    findTableById.mockReset();
    findOrder.mockReset();
    findReservation.mockReset();
    createReservation.mockReset();
    findReservationById.mockReset();
  });

  it('checks table conflicts only in the requested time slot', async () => {
    findTableById.mockReturnValue(leanResult({ _id: 'table-1' }));
    findOrder.mockReturnValue(leanResult(null));
    findReservation.mockImplementation((query: Record<string, unknown>) => (
      'tableId' in query ? leanResult(null) : Promise.resolve(null)
    ));
    createReservation.mockResolvedValue({ _id: 'reservation-1' });
    findReservationById.mockReturnValue({
      populate: vi.fn().mockResolvedValue({ _id: 'reservation-1' }),
    });
    const response = responseMock();

    await createAdminReservation({
      body: {
        tableId: 'table-1',
        clientName: 'QA Reserva',
        date: '2026-09-29',
        timeSlot: '19:00',
        partySize: 2,
      },
    } as Request, response);

    expect(findReservation).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'table-1',
      timeSlot: '19:00',
    }));
    expect(response.status).toHaveBeenCalledWith(201);
  });
});
