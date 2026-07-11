import type { NextRequest } from 'next/server';
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
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { GET, POST } from './route';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function selectChain(result: QueryResult) {
  // Route: .select(cols).eq('merchant_id').order('sort_order').order('name')
  const orderName = vi.fn().mockResolvedValue(result);
  const orderSort = vi.fn().mockReturnValue({ order: orderName });
  const eq = vi.fn().mockReturnValue({ order: orderSort });
  return { eq };
}

function insertChain(result: QueryResult) {
  return {
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(result),
    }),
  };
}

function makeSupabase(options: {
  listResult?: QueryResult;
  insertResult?: QueryResult;
}) {
  const insert = vi
    .fn()
    .mockReturnValue(
      insertChain(options.insertResult ?? { data: null, error: null })
    );
  const select = vi
    .fn()
    .mockReturnValue(
      selectChain(options.listResult ?? { data: [], error: null })
    );
  const from = vi.fn().mockReturnValue({ select, insert });
  return { from, insert, select };
}

function okAuthz(supabase: unknown) {
  return { ok: true, access: { merchantId: 'm-1' }, supabase };
}

function request(body?: unknown): NextRequest {
  return new Request('https://s.example/api/repairs/catalog/service-types', {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  loadTakenSlugs.mockResolvedValue(new Set());
});

describe('GET /api/repairs/catalog/service-types', () => {
  it('returns 401 when unauthorized', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it('returns mapped service types on success', async () => {
    const supabase = makeSupabase({
      listResult: {
        data: [
          {
            id: 's-1',
            name: 'Screen',
            slug: 'screen',
            description: null,
            sort_order: 0,
            is_active: true,
            created_at: 'a',
            updated_at: 'b',
          },
        ],
        error: null,
      },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await GET(request());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.serviceTypes).toHaveLength(1);
    expect(json.serviceTypes[0].name).toBe('Screen');
  });

  it('returns 500 when the query fails', async () => {
    const supabase = makeSupabase({
      listResult: { data: null, error: { message: 'boom' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await GET(request());
    expect(res.status).toBe(500);
  });
});

describe('POST /api/repairs/catalog/service-types', () => {
  it('returns the created service type on success', async () => {
    const supabase = makeSupabase({
      insertResult: {
        data: {
          id: 's-9',
          name: 'Battery',
          slug: 'battery',
          description: null,
          sort_order: 0,
          is_active: true,
          created_at: 'a',
          updated_at: 'b',
        },
        error: null,
      },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await POST(request({ name: 'Battery' }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.serviceType.slug).toBe('battery');
  });

  it('returns 400 for invalid input', async () => {
    const supabase = makeSupabase({});
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await POST(request({ name: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 409 on a slug uniqueness violation', async () => {
    const supabase = makeSupabase({
      insertResult: { data: null, error: { code: '23505', message: 'dup' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await POST(request({ name: 'Screen' }));
    expect(res.status).toBe(409);
  });

  it('returns 403 when the caller lacks edit permission', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      ),
    });
    const res = await POST(request({ name: 'Screen' }));
    expect(res.status).toBe(403);
  });

  it('returns 500 when the insert fails for a non-conflict reason', async () => {
    const supabase = makeSupabase({
      insertResult: { data: null, error: { code: '500', message: 'db down' } },
    });
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    const res = await POST(request({ name: 'Screen' }));
    expect(res.status).toBe(500);
  });

  it('returns 500 when the slug lookup fails', async () => {
    const supabase = makeSupabase({});
    authorizeRepairsRequest.mockResolvedValue(okAuthz(supabase));
    loadTakenSlugs.mockRejectedValue(new Error('db down'));
    const res = await POST(request({ name: 'Screen' }));
    expect(res.status).toBe(500);
  });
});
