import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  authorizeRepairsRequest: vi.fn(),
  createClient: vi.fn(),
  bookRepairPickup: vi.fn(),
}));

vi.mock('@/lib/repairs/catalog-admin-auth', () => ({
  authorizeRepairsRequest: mocks.authorizeRepairsRequest,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/repairs/book-repair-pickup', () => ({
  bookRepairPickup: mocks.bookRepairPickup,
}));

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';
const params = Promise.resolve({ id: VALID_ID });

type ManualRow = {
  admin_notes: string | null;
  shipment_id: string | null;
  pickup_booking_lock_token: string | null;
  pickup_booking_started_at: string | null;
};

function manualClient(
  exists: boolean,
  overrides: Partial<ManualRow> = {},
  updateMatched = true
) {
  const row: ManualRow = {
    admin_notes: 'prior',
    shipment_id: null,
    pickup_booking_lock_token: null,
    pickup_booking_started_at: null,
    ...overrides,
  };
  const orCalls: string[] = [];
  const updateTerminal = {
    eq() {
      return this;
    },
    neq() {
      return this;
    },
    is() {
      return this;
    },
    or(filter: string) {
      orCalls.push(filter);
      return this;
    },
    select() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({
        data: updateMatched ? { id: VALID_ID } : null,
        error: null,
      });
    },
  };
  const update = vi.fn().mockReturnValue(updateTerminal);
  return {
    from() {
      const builder = {
        select() {
          return builder;
        },
        update,
        eq() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({
            data: exists ? row : null,
            error: null,
          });
        },
      };
      return builder;
    },
    update,
    orCalls,
  };
}

/**
 * Manual-pickup client double whose lookup or note-write fails, exercising the
 * server-error path in recordManualPickup.
 */
function manualClientFailure(stage: 'lookup' | 'update') {
  const failure = { data: null, error: { message: 'db down' } };
  return {
    from() {
      const builder = {
        select() {
          return builder;
        },
        update() {
          return {
            eq() {
              return this;
            },
            neq() {
              return this;
            },
            is() {
              return this;
            },
            or() {
              return this;
            },
            select() {
              return this;
            },
            maybeSingle() {
              return Promise.resolve(
                stage === 'update' ? failure : { data: null, error: null }
              );
            },
          };
        },
        eq() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve(
            stage === 'lookup'
              ? failure
              : {
                  data: {
                    admin_notes: 'prior',
                    shipment_id: null,
                    pickup_booking_lock_token: null,
                    pickup_booking_started_at: null,
                  },
                  error: null,
                }
          );
        },
      };
      return builder;
    },
  };
}

function authorized(supabase: unknown = {}) {
  return { ok: true, access: { merchantId: 'm-1' }, supabase };
}

function req(body?: unknown): Request {
  return new Request(`https://x/api/repairs/bookings/${VALID_ID}/pickup`, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('POST /api/repairs/bookings/[id]/pickup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRepairsRequest.mockResolvedValue(authorized());
    mocks.createClient.mockReturnValue({});
  });

  it('returns 401 when unauthorized', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await POST(req({ mode: 'auto' }) as never, { params });
    expect(res.status).toBe(401);
  });

  it('books a courier pickup and returns the result', async () => {
    mocks.bookRepairPickup.mockResolvedValueOnce({
      ok: true,
      trackingNumber: 'TRK-1',
      carrierName: 'GIG Logistics',
      shipmentId: 'ship-1',
      pickupScheduledAt: null,
    });
    const res = await POST(req({ mode: 'auto' }) as never, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toMatchObject({ ok: true, trackingNumber: 'TRK-1' });
    expect(mocks.createClient).toHaveBeenCalled();
  });

  it('returns 400 for a malformed JSON body instead of booking a pickup', async () => {
    const res = await POST(
      new Request('https://s.example/api/repairs/bookings/x/pickup', {
        method: 'POST',
        body: '{ not valid json',
      }) as never,
      { params }
    );
    expect(res.status).toBe(400);
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
  });

  it('returns 200 with a recoverable failure the UI can show', async () => {
    mocks.bookRepairPickup.mockResolvedValueOnce({
      ok: false,
      reason: 'gigl_unavailable',
      message: 'No coverage',
      canRetryManually: true,
    });
    const res = await POST(req({ mode: 'auto' }) as never, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toMatchObject({ ok: false, canRetryManually: true });
  });

  it('maps a missing booking to 404', async () => {
    mocks.bookRepairPickup.mockResolvedValueOnce({
      ok: false,
      reason: 'not_found',
      message: 'Repair booking not found.',
      canRetryManually: false,
    });
    const res = await POST(req({ mode: 'auto' }) as never, { params });
    expect(res.status).toBe(404);
  });

  it('records a manual pickup arrangement without calling the courier', async () => {
    const client = manualClient(true);
    mocks.authorizeRepairsRequest.mockResolvedValueOnce(authorized(client));
    const res = await POST(req({ mode: 'manual' }) as never, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, manual: true });
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pickup_payment_status: 'manual_fulfilled',
        pickup_booking_lock_token: null,
        pickup_booking_started_at: null,
      })
    );
  });

  it('bugfix: uses the authenticated RLS client for manual fulfillment writes', async () => {
    const client = manualClient(true);
    mocks.authorizeRepairsRequest.mockResolvedValueOnce(authorized(client));
    await POST(req({ mode: 'manual' }) as never, { params });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(client.update).toHaveBeenCalled();
  });

  it('bugfix: allows grandfathered null pickup_payment_status through the manual filter', async () => {
    const client = manualClient(true);
    mocks.authorizeRepairsRequest.mockResolvedValueOnce(authorized(client));
    const res = await POST(req({ mode: 'manual' }) as never, { params });
    expect(res.status).toBe(200);
    expect(client.orCalls[0]).toContain('pickup_payment_status.is.null');
    expect(client.orCalls[0]).toContain('pickup_payment_status.neq.booked');
    expect(client.orCalls[0]).toContain(
      'pickup_payment_status.neq.manual_fulfilled'
    );
  });

  it('bugfix: returns 409 when manual fallback races a linked shipment', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce(
      authorized(
        manualClient(true, {
          shipment_id: '00000000-0000-4000-8000-000000000099',
        })
      )
    );
    const res = await POST(req({ mode: 'manual' }) as never, { params });
    expect(res.status).toBe(409);
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
  });

  it('bugfix: returns 409 when an automatic booking lock is still active', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce(
      authorized(
        manualClient(true, {
          pickup_booking_lock_token: 'lock-token',
          pickup_booking_started_at: new Date().toISOString(),
        })
      )
    );
    const res = await POST(req({ mode: 'manual' }) as never, { params });
    expect(res.status).toBe(409);
  });

  it('returns 404 when marking pickup manual on a missing booking', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce(
      authorized(manualClient(false))
    );
    const res = await POST(req({ mode: 'manual' }) as never, { params });
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-uuid booking id', async () => {
    const res = await POST(req({ mode: 'auto' }) as never, {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    expect(res.status).toBe(400);
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid pickup mode', async () => {
    const res = await POST(req({ mode: 'teleport' }) as never, { params });
    expect(res.status).toBe(400);
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
  });

  it('returns 500 when the manual booking lookup fails', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce(
      authorized(manualClientFailure('lookup'))
    );
    const res = await POST(req({ mode: 'manual' }) as never, { params });
    expect(res.status).toBe(500);
  });

  it('returns 500 when the manual note write fails', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce(
      authorized(manualClientFailure('update'))
    );
    const res = await POST(req({ mode: 'manual' }) as never, { params });
    expect(res.status).toBe(500);
  });
});
