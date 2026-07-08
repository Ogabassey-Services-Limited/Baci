import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeRepairsRequest } = vi.hoisted(() => ({
  authorizeRepairsRequest: vi.fn(),
}));

vi.mock('@/lib/repairs/catalog-admin-auth', () => ({
  authorizeRepairsRequest,
}));
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

function deviceRow(over: Record<string, unknown> = {}) {
  return {
    id: VALID_ID,
    brand: 'Apple',
    model: 'iPhone 12',
    slug: 'apple-iphone-12',
    device_type: 'Smartphone',
    product_id: null,
    aliases: [],
    image_url: null,
    is_active: true,
    sort_order: 0,
    created_at: 'a',
    updated_at: 'b',
    ...over,
  };
}

function makeSupabase(opts: {
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

function okAuthz(supabase: unknown) {
  return { ok: true, access: { merchantId: 'm-1' }, supabase };
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function reqOf(method: string, body?: unknown) {
  return new Request('https://s.example/api/repairs/catalog/devices/x', {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH device [id]', () => {
  it('returns 400 for a non-uuid id', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz(makeSupabase({})));
    const res = await PATCH(
      reqOf('PATCH', { isActive: false }) as never,
      ctx('bad')
    );
    expect(res.status).toBe(400);
  });

  it('updates and returns the device', async () => {
    const supabase = makeSupabase({
      update: { data: deviceRow({ is_active: false }), error: null },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await PATCH(
      reqOf('PATCH', { isActive: false }) as never,
      ctx(VALID_ID)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.device.isActive).toBe(false);
  });

  it('returns 404 when the device is missing', async () => {
    const supabase = makeSupabase({
      update: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await PATCH(
      reqOf('PATCH', { isActive: false }) as never,
      ctx(VALID_ID)
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when the product link is invalid', async () => {
    const supabase = makeSupabase({
      update: { data: null, error: { code: '23503', message: 'fk' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await PATCH(
      reqOf('PATCH', { productId: VALID_ID }) as never,
      ctx(VALID_ID)
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE device [id]', () => {
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

  it('deletes the device (cascading its quotes)', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz(makeSupabase({})));
    const res = await DELETE(reqOf('DELETE') as never, ctx(VALID_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
