import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeRepairsRequest, createAdminClient } = vi.hoisted(() => ({
  authorizeRepairsRequest: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/repairs/catalog-admin-auth', () => ({
  authorizeRepairsRequest,
}));
vi.mock('@/lib/supabase/admin', () => ({ createClient: createAdminClient }));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { GET, POST } from './route';

const VALID_ID = 'a1111111-1111-4111-8111-111111111111';

function quoteRow(over: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    device_id: VALID_ID,
    service_type_id: 'b2222222-2222-4222-8222-222222222222',
    price: 25000,
    is_from_price: true,
    part_quality: null,
    turnaround: null,
    warranty_days: null,
    description: null,
    internal_notes: 'supplier X',
    is_active: true,
    created_at: 'a',
    updated_at: 'b',
    ...over,
  };
}

function listChain(result: { data: unknown; error: unknown }) {
  const eqChain: Record<string, unknown> = {};
  eqChain.eq = vi.fn().mockReturnValue(eqChain);
  eqChain.order = vi.fn().mockResolvedValue(result);
  return { eq: vi.fn().mockReturnValue(eqChain) };
}

function insertChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(result),
    }),
  };
}

function makeAdmin(opts: {
  list?: { data: unknown; error: unknown };
  insert?: { data: unknown; error: unknown };
}) {
  const select = vi
    .fn()
    .mockReturnValue(listChain(opts.list ?? { data: [], error: null }));
  const insert = vi
    .fn()
    .mockReturnValue(insertChain(opts.insert ?? { data: null, error: null }));
  const from = vi.fn().mockReturnValue({ select, insert });
  return { from, select, insert };
}

function okAuthz() {
  return { ok: true, access: { merchantId: 'm-1' }, supabase: {} };
}

function req(url: string, body?: unknown) {
  return new Request(url, {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  });
}

const BASE = 'https://s.example/api/repairs/catalog/quotes';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/repairs/catalog/quotes', () => {
  it('returns 401 when unauthorized', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await GET(req(BASE) as never);
    expect(res.status).toBe(401);
  });

  it('returns mapped quotes including internal notes (service-role read)', async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({ list: { data: [quoteRow()], error: null } })
    );
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await GET(req(`${BASE}?deviceId=${VALID_ID}`) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quotes[0].internalNotes).toBe('supplier X');
  });

  it('returns 400 for an invalid deviceId filter', async () => {
    createAdminClient.mockReturnValue(makeAdmin({}));
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await GET(req(`${BASE}?deviceId=nope`) as never);
    expect(res.status).toBe(400);
  });

  it('returns 500 when the query fails', async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({ list: { data: null, error: { message: 'x' } } })
    );
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await GET(req(BASE) as never);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/repairs/catalog/quotes', () => {
  const body = {
    deviceId: VALID_ID,
    serviceTypeId: 'b2222222-2222-4222-8222-222222222222',
    price: 25000,
  };

  it('creates a quote', async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({ insert: { data: quoteRow(), error: null } })
    );
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await POST(req(BASE, body) as never);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.quote.price).toBe(25000);
  });

  it('returns 400 for invalid input', async () => {
    createAdminClient.mockReturnValue(makeAdmin({}));
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await POST(req(BASE, { price: -1 }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 409 on a duplicate quote', async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({
        insert: { data: null, error: { code: '23505', message: 'dup' } },
      })
    );
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await POST(req(BASE, body) as never);
    expect(res.status).toBe(409);
  });

  it('returns 400 when device or service type is invalid (FK)', async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({
        insert: { data: null, error: { code: '23503', message: 'fk' } },
      })
    );
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await POST(req(BASE, body) as never);
    expect(res.status).toBe(400);
  });

  it('returns 403 without edit permission', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      ),
    });
    const res = await POST(req(BASE, body) as never);
    expect(res.status).toBe(403);
  });
});
