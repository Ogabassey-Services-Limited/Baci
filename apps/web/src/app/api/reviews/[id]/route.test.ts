import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from './route';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn() }),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn().mockResolvedValue({
    merchantId: 'merchant-1',
    role: 'owner',
    permissions: {},
  }),
  toUserAccess: vi.fn(() => ({})),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

const REVIEW_ID = 'review-1';
const MERCHANT_ID = 'merchant-1';
const UPDATED_AT = '2026-05-11T00:00:00.000Z';

function buildSupabase({
  reviewLookup,
  updateResult,
}: {
  reviewLookup?: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
} = {}) {
  const reviewBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      reviewLookup ?? {
        data: { id: REVIEW_ID, merchant_id: MERCHANT_ID },
        error: null,
      }
    ),
  };

  const updateBuilder = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      updateResult ?? {
        data: {
          id: REVIEW_ID,
          status: 'approved',
          merchant_response: null,
          merchant_response_at: null,
        },
        error: null,
      }
    ),
  };

  // First .from() call (lookup) → reviewBuilder; second (update) → updateBuilder.
  const from = vi.fn();
  from.mockReturnValueOnce(reviewBuilder).mockReturnValueOnce(updateBuilder);

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from,
    _reviewBuilder: reviewBuilder,
    _updateBuilder: updateBuilder,
  };
}

function buildGetSupabase() {
  const selectCalls: string[] = [];
  const detailBuilder = {
    select: vi.fn((columns: string) => {
      selectCalls.push(columns);
      return detailBuilder;
    }),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: REVIEW_ID,
        merchant_id: MERCHANT_ID,
        customer_email: 'buyer@example.com',
        rating: 5,
      },
      error: null,
    }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn(() => detailBuilder),
    _selectCalls: selectCalls,
    _detailBuilder: detailBuilder,
  };
}

function buildRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/reviews/${REVIEW_ID}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

function callPatch(req: NextRequest) {
  return PATCH(req, { params: Promise.resolve({ id: REVIEW_ID }) });
}

function callGet() {
  return GET(new NextRequest(`http://localhost/api/reviews/${REVIEW_ID}`), {
    params: Promise.resolve({ id: REVIEW_ID }),
  });
}

async function readJson(response: Response) {
  return JSON.parse(await response.text());
}

describe('PATCH /api/reviews/[id] response shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects only the four moderation columns on update (regression: PR #1556 partial response)', async () => {
    const supabase = buildSupabase();
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockReturnValue(
      supabase as unknown as never
    );

    const res = await callPatch(await buildRequest({ status: 'approved' }));

    // The update builder's .select() must request exactly the partial-row shape.
    // This is the contract enforced by the .select('id, status, ...') optimization.
    expect(supabase._updateBuilder.select).toHaveBeenCalledWith(
      'id, status, merchant_response, merchant_response_at'
    );

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    // The response review must be the partial shape — not full row.
    expect(Object.keys(body.review).sort()).toEqual([
      'id',
      'merchant_response',
      'merchant_response_at',
      'status',
    ]);
    // Sensitive / large fields (rating, title, body, customer_email) must not leak.
    expect(body.review).not.toHaveProperty('rating');
    expect(body.review).not.toHaveProperty('title');
    expect(body.review).not.toHaveProperty('body');
    expect(body.review).not.toHaveProperty('customer_email');
  });

  it('returns merchant_response_at populated when responding', async () => {
    const supabase = buildSupabase({
      updateResult: {
        data: {
          id: REVIEW_ID,
          status: 'pending',
          merchant_response: 'Thanks for the feedback!',
          merchant_response_at: UPDATED_AT,
        },
        error: null,
      },
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockReturnValue(
      supabase as unknown as never
    );

    const res = await callPatch(
      await buildRequest({ merchantResponse: 'Thanks for the feedback!' })
    );

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.review.merchant_response).toBe('Thanks for the feedback!');
    expect(body.review.merchant_response_at).toBe(UPDATED_AT);
  });

  it('returns 400 when no valid updates are supplied', async () => {
    const supabase = buildSupabase();
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockReturnValue(
      supabase as unknown as never
    );

    const res = await callPatch(await buildRequest({}));
    expect(res.status).toBe(400);
    expect(supabase._updateBuilder.update).not.toHaveBeenCalled();
  });

  it('returns 404 when review does not exist', async () => {
    const supabase = buildSupabase({
      reviewLookup: { data: null, error: { message: 'not found' } },
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockReturnValue(
      supabase as unknown as never
    );

    const res = await callPatch(await buildRequest({ status: 'approved' }));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/reviews/[id] response shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses an explicit review detail projection instead of selecting every column', async () => {
    const supabase = buildGetSupabase();
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockReturnValue(
      supabase as unknown as never
    );

    const res = await callGet();

    expect(res.status).toBe(200);
    expect(supabase._selectCalls).toHaveLength(1);
    expect(supabase._selectCalls[0]).not.toContain('customer_email');
    expect(supabase._selectCalls[0]).not.toContain('order_id');
    expect(supabase._selectCalls[0]).toContain('products:product_id');
    expect(supabase._selectCalls[0]).not.toMatch(/(^|[,\s])\*($|[,\s])/);
    expect(supabase._detailBuilder.eq).toHaveBeenCalledWith(
      'merchant_id',
      MERCHANT_ID
    );
  });
});
