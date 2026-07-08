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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { DELETE, PATCH } from './route';

const VALID_ID = 'a1111111-1111-4111-8111-111111111111';

function resolvingChain(path: string[], result: unknown): unknown {
  if (path.length === 0) {
    return Promise.resolve(result);
  }
  const [head, ...rest] = path;
  return { [head]: vi.fn().mockReturnValue(resolvingChain(rest, result)) };
}

function quoteRow(over: Record<string, unknown> = {}) {
  return {
    id: VALID_ID,
    device_id: VALID_ID,
    service_type_id: 'b2222222-2222-4222-8222-222222222222',
    price: 25000,
    is_from_price: true,
    part_quality: null,
    turnaround: null,
    warranty_days: null,
    description: null,
    internal_notes: 'note',
    is_active: true,
    created_at: 'a',
    updated_at: 'b',
    ...over,
  };
}

function makeAdmin(opts: {
  update?: { data: unknown; error: unknown };
  del?: { error: unknown };
}) {
  const update = vi
    .fn()
    .mockReturnValue(
      resolvingChain(
        ['eq', 'eq', 'select', 'single'],
        opts.update ?? { data: null, error: null }
      )
    );
  const del = vi
    .fn()
    .mockReturnValue(resolvingChain(['eq', 'eq'], opts.del ?? { error: null }));
  const from = vi.fn().mockReturnValue({ update, delete: del });
  return { from, update, delete: del };
}

function okAuthz() {
  return { ok: true, access: { merchantId: 'm-1' }, supabase: {} };
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function reqOf(method: string, body?: unknown) {
  return new Request('https://s.example/api/repairs/catalog/quotes/x', {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH quote [id]', () => {
  it('returns 400 for a non-uuid id', async () => {
    createAdminClient.mockReturnValue(makeAdmin({}));
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await PATCH(
      reqOf('PATCH', { price: 100 }) as never,
      ctx('bad')
    );
    expect(res.status).toBe(400);
  });

  it('updates and returns the quote', async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({ update: { data: quoteRow({ price: 30000 }), error: null } })
    );
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await PATCH(
      reqOf('PATCH', { price: 30000 }) as never,
      ctx(VALID_ID)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quote.price).toBe(30000);
  });

  it('returns 404 when the quote is missing', async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({
        update: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
      })
    );
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await PATCH(
      reqOf('PATCH', { price: 100 }) as never,
      ctx(VALID_ID)
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when no fields change', async () => {
    createAdminClient.mockReturnValue(makeAdmin({}));
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await PATCH(reqOf('PATCH', {}) as never, ctx(VALID_ID));
    expect(res.status).toBe(400);
  });
});

describe('DELETE quote [id]', () => {
  it('returns 403 without delete permission', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      ),
    });
    const res = await DELETE(reqOf('DELETE') as never, ctx(VALID_ID));
    expect(res.status).toBe(403);
  });

  it('deletes the quote', async () => {
    createAdminClient.mockReturnValue(makeAdmin({}));
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await DELETE(reqOf('DELETE') as never, ctx(VALID_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
