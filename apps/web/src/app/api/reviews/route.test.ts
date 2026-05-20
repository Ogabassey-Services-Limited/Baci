import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn() }),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
  toUserAccess: vi.fn(() => ({})),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyNewReview: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const MERCHANT_ID = '22222222-2222-4222-8222-222222222222';

function buildSupabase({
  productLookup,
  existingReview,
  insertResult,
}: {
  productLookup?: { data: unknown; error: unknown };
  existingReview?: { data: unknown };
  insertResult?: { data: unknown; error: unknown };
} = {}) {
  // Track every .select() call so the test can pin the explicit column string
  // the PR introduced.
  const selectCalls: string[] = [];

  const productBuilder = {
    select: vi.fn((cols: string) => {
      selectCalls.push(`products.select:${cols}`);
      return productBuilder;
    }),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      productLookup ?? {
        data: {
          id: PRODUCT_ID,
          merchant_id: MERCHANT_ID,
          name: 'Test Product',
        },
        error: null,
      }
    ),
  };

  const existingReviewBuilder = {
    select: vi.fn((cols: string) => {
      selectCalls.push(`product_reviews.exists.select:${cols}`);
      return existingReviewBuilder;
    }),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(existingReview ?? { data: null }),
  };

  const ordersBuilder = {
    select: vi.fn(() => ordersBuilder),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [] }),
  };

  const insertBuilder = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn((cols: string) => {
      selectCalls.push(`product_reviews.insert.select:${cols}`);
      return insertBuilder;
    }),
    single: vi.fn().mockResolvedValue(
      insertResult ?? {
        data: {
          id: 'review-1',
          product_id: PRODUCT_ID,
          merchant_id: MERCHANT_ID,
          order_id: null,
          customer_email: 'test@example.com',
          customer_name: 'Test',
          rating: 5,
          title: 'Great',
          body: 'Loved it',
          status: 'pending',
          verified_purchase: false,
          created_at: '2026-05-12T00:00:00.000Z',
        },
        error: null,
      }
    ),
  };

  // from() is called multiple times in POST: products, product_reviews (exists),
  // orders, then product_reviews (insert). Route them in call order.
  const from = vi.fn();
  from
    .mockReturnValueOnce(productBuilder) // 1. products lookup
    .mockReturnValueOnce(existingReviewBuilder) // 2. existing review check
    .mockReturnValueOnce(ordersBuilder) // 3. verified-purchase orders
    .mockReturnValueOnce(insertBuilder); // 4. insert review

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },
    from,
    _selectCalls: selectCalls,
    _insertBuilder: insertBuilder,
  };
}

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/reviews', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validPayload = {
  productId: PRODUCT_ID,
  merchantId: MERCHANT_ID,
  customerEmail: 'test@example.com',
  customerName: 'Test User',
  rating: 5,
  title: 'Great product',
  body: 'Loved it.',
};

async function readJson(response: Response) {
  return JSON.parse(await response.text());
}

describe('POST /api/reviews response shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects the explicit column list on insert (regression: PR #1556 partial response)', async () => {
    const supabase = buildSupabase();
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockReturnValue(
      supabase as unknown as never
    );

    const res = await POST(buildRequest(validPayload));

    // The insert builder's .select() must request exactly the column string
    // this PR pinned. A future edit that loosens to `.select()` (i.e. `*`) or
    // drops a column would fail this assertion.
    const insertSelectCall = supabase._selectCalls.find((c) =>
      c.startsWith('product_reviews.insert.select:')
    );
    expect(insertSelectCall).toBe(
      'product_reviews.insert.select:id, product_id, merchant_id, order_id, customer_email, customer_name, rating, title, body, status, verified_purchase, created_at'
    );

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.review).toBeDefined();
    // Response review must NOT have the dropped columns (e.g. updated_at,
    // merchant_response). Drop-list reflects what `.select(...)` omits.
    expect(body.review).not.toHaveProperty('updated_at');
    expect(body.review).not.toHaveProperty('merchant_response');
    expect(body.review).not.toHaveProperty('merchant_response_at');
  });

  it('returns 400 on invalid input', async () => {
    const res = await POST(
      buildRequest({ ...validPayload, customerEmail: 'not-an-email' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when product does not exist', async () => {
    const supabase = buildSupabase({
      productLookup: { data: null, error: { message: 'not found' } },
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockReturnValue(
      supabase as unknown as never
    );

    const res = await POST(buildRequest(validPayload));
    expect(res.status).toBe(404);
    // Insert builder must NOT have been hit when product lookup fails.
    expect(supabase._insertBuilder.insert).not.toHaveBeenCalled();
  });

  it('returns 409 when customer already reviewed this product', async () => {
    const supabase = buildSupabase({
      existingReview: { data: { id: 'existing-1' } },
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockReturnValue(
      supabase as unknown as never
    );

    const res = await POST(buildRequest(validPayload));
    expect(res.status).toBe(409);
    expect(supabase._insertBuilder.insert).not.toHaveBeenCalled();
  });
});
