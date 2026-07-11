import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from './route';

const mocks = vi.hoisted(() => ({
  authorizeRepairsRequest: vi.fn(),
  createClient: vi.fn(),
  notifyRepairStatusChange: vi.fn(),
}));

vi.mock('@/lib/repairs/catalog-admin-auth', () => ({
  authorizeRepairsRequest: mocks.authorizeRepairsRequest,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/repairs/notify-repair-status-change', () => ({
  notifyRepairStatusChange: mocks.notifyRepairStatusChange,
}));

type Responses = Record<string, { data: unknown; error: unknown }>;

function makeAdmin(responses: Responses) {
  return {
    from(table: string) {
      let op = 'select';
      const builder = {
        select() {
          return builder;
        },
        update() {
          op = 'update';
          return builder;
        },
        eq() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve(responses[`${table}.select`]);
        },
        single() {
          return Promise.resolve(responses[`${table}.${op}`]);
        },
        // biome-ignore lint/suspicious/noThenProperty: test double mimics a thenable query builder for awaited update chains
        then(f: (v: unknown) => unknown, r?: (e: unknown) => unknown) {
          return Promise.resolve(responses[`${table}.${op}`]).then(f, r);
        },
      };
      return builder;
    },
  };
}

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';
const params = Promise.resolve({ id: VALID_ID });

const detailRow = {
  id: VALID_ID,
  ticket_number: 1042,
  status: 'pending',
  device_type: 'Smartphone',
  device_model: 'iPhone 15',
  repair_type_label: null,
  quoted_price: null,
  estimated_cost: null,
  service_type: 'dropoff',
  created_at: '2026-07-01T00:00:00.000Z',
  customer_name: 'Ada',
  customer_email: 'ada@example.com',
  customer_phone: '080',
  issue_description: 'cracked',
  admin_notes: null,
  pickup_address: null,
  preferred_date: null,
  updated_at: '2026-07-02T00:00:00.000Z',
  shipment_id: null,
  quote_id: null,
};

function authorized() {
  return { ok: true, access: { merchantId: 'm-1' }, supabase: {} };
}

function req(body?: unknown): Request {
  return new Request(`https://x/api/repairs/bookings/${VALID_ID}`, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('GET /api/repairs/bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRepairsRequest.mockResolvedValue(authorized());
  });

  it('returns 401 when unauthorized', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await GET(req() as never, { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the booking is missing', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({ 'repairs.select': { data: null, error: null } })
    );
    const res = await GET(req() as never, { params });
    expect(res.status).toBe(404);
  });

  it('returns the booking detail with tracking number', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({
        'repairs.select': {
          data: { ...detailRow, shipment_id: 'ship-1' },
          error: null,
        },
        'shipments.select': {
          data: { tracking_number: 'TRK-1' },
          error: null,
        },
      })
    );
    const res = await GET(req() as never, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking).toMatchObject({
      ticketNumber: 1042,
      trackingNumber: 'TRK-1',
    });
  });

  it('returns 400 for a non-uuid booking id', async () => {
    const res = await GET(req() as never, {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    expect(res.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('returns 500 when the booking query fails', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({
        'repairs.select': { data: null, error: { message: 'boom' } },
      })
    );
    const res = await GET(req() as never, { params });
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/repairs/bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRepairsRequest.mockResolvedValue(authorized());
    mocks.notifyRepairStatusChange.mockResolvedValue(undefined);
  });

  it('returns 401 when unauthorized', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await PATCH(req({ status: 'confirmed' }) as never, { params });
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-uuid booking id', async () => {
    const res = await PATCH(req({ status: 'confirmed' }) as never, {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an empty update', async () => {
    const res = await PATCH(req({}) as never, { params });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the booking to update is missing', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({ 'repairs.select': { data: null, error: null } })
    );
    const res = await PATCH(req({ status: 'confirmed' }) as never, { params });
    expect(res.status).toBe(404);
    expect(mocks.notifyRepairStatusChange).not.toHaveBeenCalled();
  });

  it('returns 500 when the booking lookup fails', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({
        'repairs.select': { data: null, error: { message: 'boom' } },
      })
    );
    const res = await PATCH(req({ status: 'confirmed' }) as never, { params });
    expect(res.status).toBe(500);
  });

  it('returns 500 when the update write fails', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({
        'repairs.select': {
          data: { ...detailRow, status: 'pending' },
          error: null,
        },
        'repairs.update': { data: null, error: { message: 'boom' } },
      })
    );
    const res = await PATCH(req({ status: 'confirmed' }) as never, { params });
    expect(res.status).toBe(500);
  });

  it('rejects an invalid status transition with 409', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({
        'repairs.select': {
          data: { ...detailRow, status: 'pending', ticket_number: 1042 },
          error: null,
        },
      })
    );
    const res = await PATCH(req({ status: 'completed' }) as never, { params });
    expect(res.status).toBe(409);
    expect(mocks.notifyRepairStatusChange).not.toHaveBeenCalled();
  });

  it('applies a valid transition and notifies the customer', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({
        'repairs.select': {
          data: { ...detailRow, status: 'pending' },
          error: null,
        },
        'repairs.update': {
          data: { ...detailRow, status: 'confirmed' },
          error: null,
        },
        'shipments.select': { data: null, error: null },
      })
    );
    const res = await PATCH(req({ status: 'confirmed' }) as never, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.status).toBe('confirmed');
    expect(mocks.notifyRepairStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed', ticketNumber: 1042 })
    );
  });

  it('updates cost/notes without notifying when status is unchanged', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({
        'repairs.select': { data: detailRow, error: null },
        'repairs.update': {
          data: { ...detailRow, estimated_cost: 25_000 },
          error: null,
        },
        'shipments.select': { data: null, error: null },
      })
    );
    const res = await PATCH(req({ estimated_cost: 25_000 }) as never, {
      params,
    });
    expect(res.status).toBe(200);
    expect(mocks.notifyRepairStatusChange).not.toHaveBeenCalled();
  });
});
