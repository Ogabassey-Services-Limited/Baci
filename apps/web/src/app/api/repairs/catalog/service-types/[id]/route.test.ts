import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeRepairsRequest } = vi.hoisted(() => ({
  authorizeRepairsRequest: vi.fn(),
}));

vi.mock('@/lib/repairs/catalog-admin-auth', () => ({
  authorizeRepairsRequest,
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { DELETE, PATCH } from './route';

const VALID_ID = 'a1111111-1111-4111-8111-111111111111';

function updateChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue(result),
  });
  return chain;
}

function deleteChain(result: { data: unknown; error: unknown }) {
  // Route: .delete().eq('id').eq('merchant_id').select('id')
  const select = vi.fn().mockResolvedValue(result);
  const eqMerchant = vi.fn().mockReturnValue({ select });
  const eqId = vi.fn().mockReturnValue({ eq: eqMerchant });
  return { eq: eqId };
}

function makeSupabase(opts: {
  update?: { data: unknown; error: unknown };
  del?: { data: unknown; error: unknown };
}) {
  const update = vi
    .fn()
    .mockReturnValue(updateChain(opts.update ?? { data: null, error: null }));
  const del = vi
    .fn()
    .mockReturnValue(
      deleteChain(opts.del ?? { data: [{ id: VALID_ID }], error: null })
    );
  const from = vi.fn().mockReturnValue({ update, delete: del });
  return { from, update, delete: del };
}

function okAuthz(supabase: unknown) {
  return { ok: true, access: { merchantId: 'm-1' }, supabase };
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(method: string, body?: unknown) {
  return new Request('https://s.example/api/repairs/catalog/service-types/x', {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH service-type [id]', () => {
  it('returns 400 for a non-uuid id', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz(makeSupabase({})));
    const res = await PATCH(
      req('PATCH', { isActive: false }) as never,
      ctx('bad')
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when no fields change', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz(makeSupabase({})));
    const res = await PATCH(req('PATCH', {}) as never, ctx(VALID_ID));
    expect(res.status).toBe(400);
  });

  it('updates and returns the row', async () => {
    const supabase = makeSupabase({
      update: {
        data: {
          id: VALID_ID,
          name: 'Screen',
          slug: 'screen',
          description: null,
          sort_order: 1,
          is_active: false,
          created_at: 'a',
          updated_at: 'b',
        },
        error: null,
      },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await PATCH(
      req('PATCH', { isActive: false }) as never,
      ctx(VALID_ID)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.serviceType.isActive).toBe(false);
  });

  it('returns 404 when the row is missing', async () => {
    const supabase = makeSupabase({
      update: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await PATCH(
      req('PATCH', { isActive: false }) as never,
      ctx(VALID_ID)
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 without edit permission', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      ),
    });
    const res = await PATCH(
      req('PATCH', { isActive: false }) as never,
      ctx(VALID_ID)
    );
    expect(res.status).toBe(403);
  });

  it('returns 500 on a generic update failure', async () => {
    const supabase = makeSupabase({
      update: { data: null, error: { code: '500', message: 'db down' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await PATCH(
      req('PATCH', { isActive: false }) as never,
      ctx(VALID_ID)
    );
    expect(res.status).toBe(500);
  });
});

describe('DELETE service-type [id]', () => {
  it('returns 403 without delete permission', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      ),
    });
    const res = await DELETE(req('DELETE') as never, ctx(VALID_ID));
    expect(res.status).toBe(403);
  });

  it('returns success on delete', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz(makeSupabase({})));
    const res = await DELETE(req('DELETE') as never, ctx(VALID_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 404 when no matching service type was deleted', async () => {
    const supabase = makeSupabase({ del: { data: [], error: null } });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await DELETE(req('DELETE') as never, ctx(VALID_ID));
    expect(res.status).toBe(404);
  });

  it('returns 409 when the service type is still referenced by quotes', async () => {
    const supabase = makeSupabase({
      del: { data: null, error: { code: '23503', message: 'fk' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await DELETE(req('DELETE') as never, ctx(VALID_ID));
    expect(res.status).toBe(409);
  });

  it('returns 500 on a generic delete failure', async () => {
    const supabase = makeSupabase({
      del: { data: null, error: { code: '500', message: 'db down' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await DELETE(req('DELETE') as never, ctx(VALID_ID));
    expect(res.status).toBe(500);
  });
});
