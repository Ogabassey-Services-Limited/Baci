import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('next/headers', () => ({ cookies: () => Promise.resolve({}) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const MERCHANT_ID = '22222222-2222-4222-8222-222222222222';

// Generic chainable mock: select/eq return self, single resolves the product,
// insert resolves a thenable for the negotiation_logs write.
function supabaseFor(product: Record<string, unknown> | null) {
  const insert = vi.fn(() => Promise.resolve({ error: null }));
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.single = () =>
    Promise.resolve({
      data: product,
      error: product ? null : { message: 'not found' },
    });
  chain.insert = insert;
  return { supabase: { from: () => chain }, insert };
}

async function callNegotiate(
  product: Record<string, unknown> | null,
  offeredPrice: number,
  attemptNumber = 1
) {
  const { createClient } = await import('@/lib/supabase/server');
  const { supabase, insert } = supabaseFor(product);
  vi.mocked(createClient).mockReturnValue(supabase as never);
  const request = new NextRequest('http://localhost/api/storefront/negotiate', {
    method: 'POST',
    body: JSON.stringify({
      productId: PRODUCT_ID,
      merchantId: MERCHANT_ID,
      offeredPrice,
      attemptNumber,
    }),
  });
  const response = await POST(request);
  return { response, body: await response.json(), insert };
}

describe('POST /api/storefront/negotiate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a final best-price response for a budget brand and logs it', async () => {
    const { body, insert } = await callNegotiate(
      {
        id: PRODUCT_ID,
        name: 'Tecno Spark 50',
        brand: 'Tecno',
        price: 100000,
        cost_price: 80000,
        merchant_id: MERCHANT_ID,
      },
      90000
    );
    expect(body.status).toBe('final');
    expect(body.canContinue).toBe(false);
    // The non-negotiable short-circuit must still write negotiation_logs.
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'final' })
    );
  });

  it('returns a final best-price response for Samsung A-series', async () => {
    const { body } = await callNegotiate(
      {
        id: PRODUCT_ID,
        name: 'Samsung Galaxy A16 5G',
        brand: 'Samsung',
        price: 200000,
        cost_price: 150000,
        merchant_id: MERCHANT_ID,
      },
      180000
    );
    expect(body.status).toBe('final');
  });

  it('accepts a negotiable offer within 2%', async () => {
    const { body } = await callNegotiate(
      {
        id: PRODUCT_ID,
        name: 'MacBook Air M1',
        brand: 'Apple',
        price: 1000,
        cost_price: 600,
        merchant_id: MERCHANT_ID,
      },
      985
    );
    expect(body.status).toBe('accepted');
  });

  it('counters a negotiable offer beyond 2% no deeper than the 2% floor', async () => {
    const { body } = await callNegotiate(
      {
        id: PRODUCT_ID,
        name: 'MacBook Air M1',
        brand: 'Apple',
        price: 1000,
        cost_price: 600,
        merchant_id: MERCHANT_ID,
      },
      850
    );
    expect(body.status).toBe('counter');
    expect(body.counterOffer).toBeGreaterThanOrEqual(980); // ≥ 1000 * (1 - 0.02)
  });

  it('counters at the 1.5% tier on the second attempt', async () => {
    // attempt 2 tier = 1.5% → counter = max(floor 980, 1000 * 0.985 = 985) = 985.
    const { body } = await callNegotiate(
      {
        id: PRODUCT_ID,
        name: 'MacBook Air M1',
        brand: 'Apple',
        price: 1000,
        cost_price: 600,
        merchant_id: MERCHANT_ID,
      },
      850,
      2
    );
    expect(body.status).toBe('counter');
    expect(body.counterOffer).toBeGreaterThanOrEqual(985);
  });

  it('returns a final 2% offer on the third attempt', async () => {
    // attempt 3 → finalPrice = max(floor 980, 1000 * 0.98 = 980) = 980; offer
    // 850 < 980 → status 'final', counterOffer 980.
    const { body } = await callNegotiate(
      {
        id: PRODUCT_ID,
        name: 'MacBook Air M1',
        brand: 'Apple',
        price: 1000,
        cost_price: 600,
        merchant_id: MERCHANT_ID,
      },
      850,
      3
    );
    expect(body.status).toBe('final');
    expect(body.counterOffer).toBe(980);
  });

  it('accepts an offer at or above the original price', async () => {
    const { body } = await callNegotiate(
      {
        id: PRODUCT_ID,
        name: 'MacBook Air M1',
        brand: 'Apple',
        price: 1000,
        cost_price: 600,
        merchant_id: MERCHANT_ID,
      },
      1000
    );
    expect(body.status).toBe('accepted');
  });

  it('uses the 40% margin fallback when cost_price is null', async () => {
    // No cost_price → costPrice = 1000 * 0.6 = 600; minAcceptable =
    // max(600 * 1.1 = 660, 1000 * 0.98 = 980) = 980; offer 985 ≥ 980 → accepted.
    const { body } = await callNegotiate(
      {
        id: PRODUCT_ID,
        name: 'MacBook Air M1',
        brand: 'Apple',
        price: 1000,
        cost_price: null,
        merchant_id: MERCHANT_ID,
      },
      985
    );
    expect(body.status).toBe('accepted');
  });

  it('returns 404 when the product is not found', async () => {
    const { response, body } = await callNegotiate(null, 90000);
    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Product not found' });
  });

  it('returns 400 for an invalid productId UUID', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockReturnValue({} as never);
    const request = new NextRequest(
      'http://localhost/api/storefront/negotiate',
      {
        method: 'POST',
        body: JSON.stringify({
          productId: 'invalid-uuid',
          merchantId: MERCHANT_ID,
          offeredPrice: 900,
        }),
      }
    );
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request');
  });

  it('returns 400 for a non-positive offeredPrice', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockReturnValue({} as never);
    const request = new NextRequest(
      'http://localhost/api/storefront/negotiate',
      {
        method: 'POST',
        body: JSON.stringify({
          productId: PRODUCT_ID,
          merchantId: MERCHANT_ID,
          offeredPrice: -50,
        }),
      }
    );
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request');
  });
});
