import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeRepairsRequest, loadTakenSlugs } = vi.hoisted(() => ({
  authorizeRepairsRequest: vi.fn(),
  loadTakenSlugs: vi.fn(),
}));

vi.mock('@/lib/repairs/catalog-admin-auth', () => ({
  authorizeRepairsRequest,
}));
vi.mock('@/lib/repairs/catalog-admin-slugs', () => ({ loadTakenSlugs }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { GET, POST } from './route';

// Builds a nested chainable mock whose final call resolves to `result`.
function resolvingChain(path: string[], result: unknown): unknown {
  if (path.length === 0) {
    return Promise.resolve(result);
  }
  const [head, ...rest] = path;
  return { [head]: vi.fn().mockReturnValue(resolvingChain(rest, result)) };
}

function deviceRow(over: Record<string, unknown> = {}) {
  return {
    id: 'd-1',
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
  list?: { data: unknown; error: unknown };
  insert?: { data: unknown; error: unknown };
}) {
  const select = vi
    .fn()
    .mockReturnValue(
      resolvingChain(
        ['eq', 'order', 'order', 'order'],
        opts.list ?? { data: [], error: null }
      )
    );
  const insert = vi
    .fn()
    .mockReturnValue(
      resolvingChain(
        ['select', 'single'],
        opts.insert ?? { data: null, error: null }
      )
    );
  const from = vi.fn().mockReturnValue({ select, insert });
  return { from, select, insert };
}

function okAuthz(supabase: unknown) {
  return { ok: true, access: { merchantId: 'm-1' }, supabase };
}

function req(url: string, body?: unknown) {
  return new Request(url, {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  });
}

const BASE = 'https://s.example/api/repairs/catalog/devices';

beforeEach(() => {
  vi.clearAllMocks();
  loadTakenSlugs.mockResolvedValue(new Set());
});

describe('GET /api/repairs/catalog/devices', () => {
  it('returns 401 when unauthorized', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await GET(req(BASE) as never);
    expect(res.status).toBe(401);
  });

  it('returns mapped devices', async () => {
    const supabase = makeSupabase({
      list: { data: [deviceRow()], error: null },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await GET(req(BASE) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.devices).toHaveLength(1);
    expect(json.devices[0].brand).toBe('Apple');
  });

  it('filters by the q search term across brand/model/aliases', async () => {
    const supabase = makeSupabase({
      list: {
        data: [
          deviceRow({ id: 'd-1', brand: 'Apple', model: 'iPhone 12' }),
          deviceRow({
            id: 'd-2',
            brand: 'Samsung',
            model: 'Galaxy S21',
            slug: 's21',
          }),
        ],
        error: null,
      },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await GET(req(`${BASE}?q=galaxy`) as never);
    const json = await res.json();
    expect(json.devices).toHaveLength(1);
    expect(json.devices[0].brand).toBe('Samsung');
  });

  it('returns 500 when the query fails', async () => {
    const supabase = makeSupabase({
      list: { data: null, error: { message: 'boom' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await GET(req(BASE) as never);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/repairs/catalog/devices', () => {
  it('creates a device with a generated slug', async () => {
    const supabase = makeSupabase({
      insert: { data: deviceRow({ id: 'd-9' }), error: null },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await POST(
      req(BASE, { brand: 'Apple', model: 'iPhone 12' }) as never
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.device.slug).toBe('apple-iphone-12');
  });

  it('returns 400 for invalid input', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz(makeSupabase({})));
    const res = await POST(req(BASE, { brand: '' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when the product link is invalid (FK violation)', async () => {
    const supabase = makeSupabase({
      insert: { data: null, error: { code: '23503', message: 'fk' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await POST(
      req(BASE, {
        brand: 'Apple',
        model: 'iPhone 12',
        productId: 'a1111111-1111-4111-8111-111111111111',
      }) as never
    );
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
    const res = await POST(req(BASE, { brand: 'Apple', model: 'X' }) as never);
    expect(res.status).toBe(403);
  });
});
