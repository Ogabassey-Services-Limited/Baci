import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  authorizeRepairsRequest: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/repairs/catalog-admin-auth', () => ({
  authorizeRepairsRequest: mocks.authorizeRepairsRequest,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: mocks.createClient,
}));

function authorized() {
  return { ok: true, access: { merchantId: 'm-1' }, supabase: {} };
}

function makeAdmin(result: { data: unknown; error: unknown; count?: number }) {
  const range = vi.fn().mockResolvedValue(result);
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'ilike', 'order']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.range = range;
  return { from: () => builder, range, builder };
}

function buildRequest(url: string): NextRequest {
  return new Request(url, { method: 'GET' }) as unknown as NextRequest;
}

describe('GET /api/repairs/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRepairsRequest.mockResolvedValue(authorized());
  });

  it('returns 401 when unauthorized', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET(buildRequest('https://x/api/repairs/bookings'));
    expect(res.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid status filter', async () => {
    const res = await GET(
      buildRequest('https://x/api/repairs/bookings?status=shipped')
    );
    expect(res.status).toBe(400);
  });

  it('returns mapped bookings with a total count', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({
        data: [
          {
            id: 'r-1',
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
          },
        ],
        error: null,
        count: 1,
      })
    );

    const res = await GET(
      buildRequest('https://x/api/repairs/bookings?status=pending')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.bookings[0]).toMatchObject({
      ticketNumber: 1042,
      deviceLabel: 'Smartphone iPhone 15',
    });
  });

  it('returns 500 when the query fails', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({ data: null, error: { message: 'boom' } })
    );

    const res = await GET(buildRequest('https://x/api/repairs/bookings'));
    expect(res.status).toBe(500);
  });

  it('matches a numeric q against the ticket number', async () => {
    const admin = makeAdmin({ data: [], error: null, count: 0 });
    mocks.createClient.mockReturnValue(admin);

    const res = await GET(
      buildRequest('https://x/api/repairs/bookings?q=1042')
    );
    expect(res.status).toBe(200);
    expect(admin.builder.eq).toHaveBeenCalledWith('ticket_number', 1042);
    expect(admin.builder.ilike).not.toHaveBeenCalled();
  });

  it('matches a text q against the device model', async () => {
    const admin = makeAdmin({ data: [], error: null, count: 0 });
    mocks.createClient.mockReturnValue(admin);

    const res = await GET(
      buildRequest('https://x/api/repairs/bookings?q=iPhone')
    );
    expect(res.status).toBe(200);
    expect(admin.builder.ilike).toHaveBeenCalledWith(
      'device_model',
      '%iPhone%'
    );
  });
});
