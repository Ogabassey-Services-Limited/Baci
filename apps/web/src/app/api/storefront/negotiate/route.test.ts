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
});
