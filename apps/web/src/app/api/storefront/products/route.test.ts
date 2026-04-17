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
