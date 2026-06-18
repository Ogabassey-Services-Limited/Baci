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
  cookies: vi.fn(),
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

function createRequestUrl(query = '') {
  const params = new URLSearchParams({
    merchant_id: VALID_MERCHANT_ID,
  });

  if (query) {
    const extraParams = new URLSearchParams(query);
    for (const [key, value] of extraParams.entries()) {
      params.set(key, value);
    }
  }

  return `http://localhost/api/storefront/products?${params.toString()}`;
}

describe('GET /api/storefront/products', () => {
  beforeEach(() => {
    storefrontProductsRouteTestHarness.reset();
  });

  it('returns 400 when merchant_id is missing', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/storefront/products')
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Merchant ID is required');
  });

  it('logs invalid query parameters as client warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    try {
      const response = await GET(
        new NextRequest(
          'http://localhost/api/storefront/products?merchant_id=not-a-uuid'
        )
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error).toBe('Invalid parameters');
      expect(warnSpy).toHaveBeenCalledWith(
        'API Validation Failed:',
        expect.stringContaining('Invalid uuid')
      );
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('matches category filters against category slugs as well as names', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'tv-1',
          category: 'Televisions',
          categories: { id: 'cat-1', name: 'Smart TVs', slug: 'smart-tvs' },
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'phone-1',
          name: 'Galaxy S24',
          category: 'Phones',
          categories: { id: 'cat-2', name: 'Phones', slug: 'phones' },
          brand: 'Samsung',
          slug: 'galaxy-s24',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('category=smart-tvs'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0].id).toBe('tv-1');
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.ilike
    ).not.toHaveBeenCalledWith('category', expect.any(String));
  });

  it('preserves secondary category memberships during in-memory category filtering', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'tv-2',
          category: 'Gaming',
          categories: { id: 'cat-3', name: 'Consoles', slug: 'consoles' },
          product_categories: [
            {
              categories: {
                id: 'cat-1',
                name: 'Smart TVs',
                slug: 'smart-tvs',
              },
            },
          ],
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'console-1',
          category: 'Consoles',
          categories: { id: 'cat-3', name: 'Consoles', slug: 'consoles' },
          slug: 'console-1',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('category=smart-tvs'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0].id).toBe('tv-2');
  });

  it('applies limit after in-memory category filtering', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'phone-1',
          category: 'Phones',
          categories: { id: 'cat-2', name: 'Phones', slug: 'phones' },
          slug: 'phone-1',
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'tv-2',
          category: 'Televisions',
          categories: { id: 'cat-1', name: 'Smart TVs', slug: 'smart-tvs' },
          slug: 'tv-2',
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'tv-3',
          category: 'Televisions',
          categories: { id: 'cat-1', name: 'Smart TVs', slug: 'smart-tvs' },
          slug: 'tv-3',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('category=smart-tvs&limit=1'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0].id).toBe('tv-2');
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.limit
    ).not.toHaveBeenCalled();
  });

  it('matches slug-form brand filters without relying on a SQL ilike prefilter', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'sony-ericsson-1',
          brand: 'Sony Ericsson',
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'lg-1',
          name: 'LG C3',
          brand: 'LG',
          slug: 'lg-c3',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('brand=sony-ericsson'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0].brand).toBe('Sony Ericsson');
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.ilike
    ).not.toHaveBeenCalledWith('brand', expect.any(String));
  });

  it('treats brand=All as no SQL brand prefilter', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'sony-1',
          brand: 'Sony',
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'lg-1',
          name: 'LG C3',
          brand: 'LG',
          slug: 'lg-c3',
        }),
      ],
      error: null,
    };

    const response = await GET(new NextRequest(createRequestUrl('brand=All')));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(2);
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.ilike
    ).not.toHaveBeenCalledWith('brand', expect.any(String));
  });

  it('keeps database-side limit when no in-memory filters are active', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'sony-1',
          brand: 'Sony',
        }),
      ],
      error: null,
    };

    const response = await GET(new NextRequest(createRequestUrl('limit=5')));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.limit
    ).toHaveBeenCalledWith(5);
  });

  it('uses the compact product projection when requested by listing callers', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'compact-1',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('compact=true&limit=5'))
    );
    const payload = await response.json();
    const selectArg = String(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.select.mock
        .calls[0]?.[0]
    );

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(selectArg).not.toContain('description');
    expect(selectArg).toContain('has_variants');
    expect(selectArg).toContain('categories:category_id(id, name, slug)');
    expect(selectArg).not.toContain('specifications');
    expect(selectArg).not.toContain('product_key_specs');
    expect(selectArg).not.toContain('variant_attributes');
    expect(selectArg).not.toMatch(/\boffers\b/);
  });

  it('defaults listing callers to the compact product projection', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'default-compact-1',
        }),
      ],
      error: null,
    };

    const response = await GET(new NextRequest(createRequestUrl('limit=5')));
    const payload = await response.json();
    const selectArg = String(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.select.mock
        .calls[0]?.[0]
    );

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(selectArg).toContain('has_variants');
    expect(selectArg).not.toContain('specifications');
    expect(selectArg).not.toContain('variant_attributes');
  });

  it('allows explicit full projection for comparison-style callers', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'full-1',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('compact=false&limit=5'))
    );
    const payload = await response.json();
    const selectArg = String(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.select.mock
        .calls[0]?.[0]
    );

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(selectArg).toContain('specifications');
    expect(selectArg).toContain('variant_attributes');
    expect(selectArg).toContain('product_key_specs (');
    expect(selectArg).toContain('created_at');
    expect(selectArg).toContain('updated_at');
    expect(selectArg).toMatch(/\boffers\b/);
  });

  it('applies the image-presence filter when has_images=true', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'with-image-1',
          images: ['https://cdn.example.com/with-image.jpg'],
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('has_images=true'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.not
    ).toHaveBeenCalledWith('images->0', 'is', null);
  });

  it('matches condition filters against available_conditions for migrated families', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'family-1',
          name: 'MacBook Air Family',
          available_conditions: ['new', 'open_box'],
          condition: 'new',
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'family-2',
          name: 'MacBook Air New',
          available_conditions: ['new'],
          condition: 'new',
          slug: 'macbook-air-new',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('condition=open_box'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0].id).toBe('family-1');
  });

  it('broadens open_box condition prefilters to include refurbished aliases', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'family-1',
          name: 'MacBook Air Refurbished',
          condition: 'refurbished',
          available_conditions: [],
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('condition=open_box'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.or
    ).toHaveBeenCalledTimes(1);
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.or.mock
        .calls[0]?.[0]
    ).toContain('condition.eq.open_box');
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.or.mock
        .calls[0]?.[0]
    ).toContain('condition.eq.refurbished');
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.or.mock
        .calls[0]?.[0]
    ).toContain('available_conditions.cs.{open_box}');
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current?.or.mock
        .calls[0]?.[0]
    ).toContain('available_conditions.cs.{refurbished}');
  });

  it('uses ranked storefront search when q is present', async () => {
    storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce(
      {
        data: [
          { product_id: 'product-2', total_count: 2 },
          { product_id: 'product-1', total_count: 2 },
        ],
        error: null,
      }
    );

    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-1',
          name: 'iPhone X',
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-2',
          name: 'iPhone 16 Pro',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('q=iphnoe&limit=20'))
    );

    const body = await response.json();
    expect(
      storefrontProductsRouteTestHarness.mockSearchRpc.current
    ).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({
        search_query: 'iphnoe',
        sort_by: 'relevance',
      })
    );
    expect(
      storefrontProductsRouteTestHarness.mockProductsByIdsQuery.current?.in
    ).toHaveBeenCalledWith('id', ['product-2', 'product-1']);
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'product-2',
      'product-1',
    ]);
    expect(body.count).toBe(2);
  });

  it('applies the image-presence filter when q and has_images=true are present', async () => {
    storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce(
      {
        data: [
          { product_id: 'product-1', total_count: 2 },
          { product_id: 'product-2', total_count: 2 },
        ],
        error: null,
      }
    );

    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-1',
          name: 'iPhone X',
          images: [],
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-2',
          name: 'iPhone 16 Pro',
          images: ['https://cdn.example.com/iphone-16-pro.jpg'],
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('q=iphone&has_images=true&limit=20'))
    );

    const body = await response.json();
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'product-2',
    ]);
    expect(body.count).toBe(1);
    expect(
      storefrontProductsRouteTestHarness.mockSearchRpc.current
    ).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({ result_limit: 100 })
    );
  });

  it('rejects non-string image payloads when q and has_images=true are present', async () => {
    storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce(
      {
        data: [
          { product_id: 'product-1', total_count: 3 },
          { product_id: 'product-2', total_count: 3 },
          { product_id: 'product-3', total_count: 3 },
        ],
        error: null,
      }
    );

    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-1',
          name: 'iPhone X',
          images: [],
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-2',
          name: 'iPhone 16 Pro',
          images: ['https://cdn.example.com/iphone-16-pro.jpg'],
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-3',
          name: 'iPhone Case',
          images: [{ url: 'https://cdn.example.com/case.jpg' }],
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('q=iphone&has_images=true&limit=20'))
    );

    const body = await response.json();
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'product-2',
    ]);
    expect(body.count).toBe(1);
  });

  it('keeps unexpected unranked hydration rows after ranked products', async () => {
    storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce(
      {
        data: [{ product_id: 'product-2', total_count: 1 }],
        error: null,
      }
    );

    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-1',
          name: 'iPhone Case',
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-2',
          name: 'iPhone 16 Pro',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('q=iphone&limit=20'))
    );

    const body = await response.json();
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'product-2',
      'product-1',
    ]);
  });

  it('preserves category filtering when q is present', async () => {
    storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce(
      {
        data: [
          { product_id: 'product-3', total_count: 3 },
          { product_id: 'product-2', total_count: 3 },
          { product_id: 'product-1', total_count: 3 },
        ],
        error: null,
      }
    );

    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-1',
          name: 'iPhone Case',
          category: 'Accessories',
          categories: {
            id: 'cat-1',
            name: 'Accessories',
            slug: 'accessories',
          },
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-2',
          name: 'iPhone 16 Pro',
          category: 'Phones',
          categories: { id: 'cat-2', name: 'Phones', slug: 'phones' },
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-3',
          name: 'iPhone Stand',
          category: 'Accessories',
          categories: {
            id: 'cat-1',
            name: 'Accessories',
            slug: 'accessories',
          },
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('q=iphone&category=phones&limit=20'))
    );

    const body = await response.json();
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'product-2',
    ]);
    expect(body.count).toBe(1);
    expect(
      storefrontProductsRouteTestHarness.mockSearchRpc.current
    ).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({ result_limit: 100 })
    );
  });

  it('preserves slug-form brand filtering when q is present', async () => {
    storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce(
      {
        data: [
          { product_id: 'product-1', total_count: 2 },
          { product_id: 'product-2', total_count: 2 },
        ],
        error: null,
      }
    );

    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-1',
          name: 'Sony Ericsson Xperia',
          brand: 'Sony Ericsson',
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-2',
          name: 'LG C3',
          brand: 'LG',
          slug: 'lg-c3',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('q=phone&brand=sony-ericsson&limit=1'))
    );

    const body = await response.json();
    expect(
      storefrontProductsRouteTestHarness.mockSearchRpc.current
    ).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({ brand_filter: null, result_limit: 100 })
    );
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'product-1',
    ]);
    expect(body.count).toBe(1);
  });

  it('keeps ranked count when q is present with all filters', async () => {
    storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce(
      {
        data: [{ product_id: 'product-1', total_count: 7 }],
        error: null,
      }
    );

    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-1',
          name: 'iPhone 16 Pro',
          brand: 'Apple',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(
        createRequestUrl(
          'q=iphone&brand=All&category=All&condition=all&limit=1'
        )
      )
    );

    const body = await response.json();
    expect(
      storefrontProductsRouteTestHarness.mockSearchRpc.current
    ).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({ result_limit: 1 })
    );
    expect(body.count).toBe(7);
  });

  it('preserves secondary category memberships when q is present', async () => {
    storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce(
      {
        data: [
          { product_id: 'product-1', total_count: 2 },
          { product_id: 'product-2', total_count: 2 },
        ],
        error: null,
      }
    );

    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-1',
          name: 'Gaming Monitor',
          category: 'Gaming',
          categories: { id: 'cat-3', name: 'Gaming', slug: 'gaming' },
          product_categories: [
            {
              categories: {
                id: 'cat-1',
                name: 'Smart TVs',
                slug: 'smart-tvs',
              },
            },
          ],
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-2',
          name: 'Console',
          category: 'Gaming',
          categories: { id: 'cat-3', name: 'Gaming', slug: 'gaming' },
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('q=gaming&category=smart-tvs&limit=20'))
    );

    const body = await response.json();
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'product-1',
    ]);
    expect(body.count).toBe(1);
  });

  it('preserves condition-offer filtering when q is present', async () => {
    storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce(
      {
        data: [
          { product_id: 'product-1', total_count: 2 },
          { product_id: 'product-2', total_count: 2 },
        ],
        error: null,
      }
    );

    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-1',
          name: 'iPhone 13',
          condition: 'new',
          has_condition_offers: true,
          available_conditions: [],
        }),
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'product-2',
          name: 'iPhone 12',
          condition: 'new',
          has_condition_offers: false,
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('q=iphone&condition=used&limit=20'))
    );

    const body = await response.json();
    expect(
      storefrontProductsRouteTestHarness.mockSearchRpc.current
    ).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({ condition_filter: null, result_limit: 100 })
    );
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'product-1',
    ]);
    expect(body.count).toBe(1);
  });

  it('routes q filters through ranked search without raw ilike OR clauses', async () => {
    storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce(
      {
        data: [{ product_id: 'tv-1', total_count: 1 }],
        error: null,
      }
    );
    storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
      data: [
        storefrontProductsRouteTestHarness.createRawProduct({
          id: 'tv-1',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(createRequestUrl('q=%_sony\\demo'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(
      storefrontProductsRouteTestHarness.mockSearchRpc.current
    ).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({ search_query: '%_sonydemo' })
    );
    expect(
      storefrontProductsRouteTestHarness.mockProductsQuery.current
    ).toBeNull();
  });

  it('returns 500 when the products query fails', async () => {
    storefrontProductsRouteTestHarness.mockProductsResult.current = {
      data: null as never,
      error: { message: 'db failure' },
    };

    const response = await GET(new NextRequest(createRequestUrl()));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Internal server error');
  });
});
