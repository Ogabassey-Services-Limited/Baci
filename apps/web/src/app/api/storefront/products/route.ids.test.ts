import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storefrontProductsRouteTestHarness } from './route.test-helpers';

vi.mock('@supabase/supabase-js', () => ({
  createClient: storefrontProductsRouteTestHarness.mockCreateStaticClient,
}));

vi.mock('next/cache', () => ({
  unstable_cache:
    <T extends (...args: never[]) => Promise<unknown>>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('@/env', () => ({
  getSupabaseAnonKey: vi.fn(() => 'anon-key'),
  getSupabaseUrl: vi.fn(() => 'https://example.supabase.co'),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: storefrontProductsRouteTestHarness.mockCreateServerClient,
}));

import { GET } from './route';

const VALID_MERCHANT_ID = '00000000-0000-4000-8000-000000000001';

describe('GET /api/storefront/products ids flow', () => {
  beforeEach(() => {
    storefrontProductsRouteTestHarness.reset();
  });

  it('returns specific products when ids are requested', async () => {
    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-1',
          slug: 'sony-bravia',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(
        `http://localhost/api/storefront/products?merchant_id=${VALID_MERCHANT_ID}&ids=product-1`
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0].id).toBe('product-1');
    expect(
      storefrontProductsRouteTestHarness.mockProductsByIdsQuery.current?.in
    ).toHaveBeenCalledWith('id', ['product-1']);
  });

  it('returns 500 when the ids query fails', async () => {
    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: null as never,
      error: { message: 'db failure' },
    };

    const response = await GET(
      new NextRequest(
        `http://localhost/api/storefront/products?merchant_id=${VALID_MERCHANT_ID}&ids=product-1`
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Internal server error');
  });
});
