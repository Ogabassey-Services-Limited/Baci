import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateStaticClient, mockProductsQuery, mockProductsResult } =
  vi.hoisted(() => {
    const mockProductsResult = {
      current: {
        data: [] as Record<string, unknown>[],
        error: null as { message: string } | null,
      },
    };
    const mockProductsQuery = {
      current: null as {
        eq: ReturnType<typeof vi.fn>;
        gte: ReturnType<typeof vi.fn>;
        ilike: ReturnType<typeof vi.fn>;
        lte: ReturnType<typeof vi.fn>;
        or: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
        select: ReturnType<typeof vi.fn>;
      } | null,
    };

    function createProductsQuery() {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        or: vi.fn(() => query),
        ilike: vi.fn(() => query),
        gte: vi.fn(() => query),
        lte: vi.fn(() => query),
        order: vi.fn(() => Promise.resolve(mockProductsResult.current)),
      };

      mockProductsQuery.current = query;

      return query;
    }

    const mockCreateStaticClient = vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'products') {
          return createProductsQuery();
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    }));

    return {
      mockCreateStaticClient,
      mockProductsQuery,
      mockProductsResult,
    };
  });

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateStaticClient,
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
  createClient: vi.fn(),
}));

import { GET } from './route';

function createRawProduct(overrides: Partial<Record<string, unknown>>) {
  return {
    id: 'product-1',
    name: 'Sony Bravia',
    description: '4K TV',
    price: 900000,
    compare_at_price: null,
    images: ['https://cdn.example.com/tv.jpg'],
    image_hint: 'television',
    category: 'Smart TVs',
    categories: { id: 'cat-1', name: 'Smart TVs', slug: 'smart-tvs' },
    brand: 'Sony',
    stock: 4,
    stock_quantity: 4,
    slug: 'sony-bravia',
    status: 'active',
    condition: 'new',
    has_variants: false,
    sku: 'TV-1',
    manage_stock: true,
    low_stock_threshold: 1,
    colors: ['Black'],
    has_condition_offers: false,
    available_conditions: ['new'],
    ...overrides,
  };
}

describe('GET /api/storefront/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductsQuery.current = null;
    mockProductsResult.current = {
      data: [],
      error: null,
    };
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
    mockProductsResult.current = {
      data: [
        createRawProduct({
          id: 'tv-1',
          category: 'Televisions',
          categories: { id: 'cat-1', name: 'Smart TVs', slug: 'smart-tvs' },
        }),
        createRawProduct({
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
      new NextRequest(
        'http://localhost/api/storefront/products?merchant_id=00000000-0000-0000-0000-000000000001&category=smart-tvs'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0].id).toBe('tv-1');
    expect(mockProductsQuery.current?.ilike).not.toHaveBeenCalledWith(
      'category',
      expect.any(String)
    );
  });

  it('preserves secondary category memberships during in-memory category filtering', async () => {
    mockProductsResult.current = {
      data: [
        createRawProduct({
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
        createRawProduct({
          id: 'console-1',
          category: 'Consoles',
          categories: { id: 'cat-3', name: 'Consoles', slug: 'consoles' },
          slug: 'console-1',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/products?merchant_id=00000000-0000-0000-0000-000000000001&category=smart-tvs'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0].id).toBe('tv-2');
  });

  it('applies brand filters case-insensitively', async () => {
    mockProductsResult.current = {
      data: [
        createRawProduct({ id: 'sony-1', brand: 'Sony' }),
        createRawProduct({
          id: 'lg-1',
          name: 'LG C3',
          brand: 'LG',
          slug: 'lg-c3',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/products?merchant_id=00000000-0000-0000-0000-000000000001&brand=sony'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0].brand).toBe('Sony');
    expect(mockProductsQuery.current?.ilike).toHaveBeenCalledWith(
      'brand',
      '%sony%'
    );
  });

  it('treats brand=All as no SQL brand prefilter', async () => {
    mockProductsResult.current = {
      data: [
        createRawProduct({ id: 'sony-1', brand: 'Sony' }),
        createRawProduct({
          id: 'lg-1',
          name: 'LG C3',
          brand: 'LG',
          slug: 'lg-c3',
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/products?merchant_id=00000000-0000-0000-0000-000000000001&brand=All'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(2);
    expect(mockProductsQuery.current?.ilike).not.toHaveBeenCalledWith(
      'brand',
      expect.any(String)
    );
  });

  it('matches condition filters against available_conditions for migrated families', async () => {
    mockProductsResult.current = {
      data: [
        createRawProduct({
          id: 'family-1',
          name: 'MacBook Air Family',
          available_conditions: ['new', 'open_box'],
          condition: 'new',
        }),
        createRawProduct({
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
      new NextRequest(
        'http://localhost/api/storefront/products?merchant_id=00000000-0000-0000-0000-000000000001&condition=open_box'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0].id).toBe('family-1');
  });

  it('broadens open_box condition prefilters to include refurbished aliases', async () => {
    mockProductsResult.current = {
      data: [
        createRawProduct({
          id: 'family-1',
          name: 'MacBook Air Refurbished',
          condition: 'refurbished',
          available_conditions: [],
        }),
      ],
      error: null,
    };

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/products?merchant_id=00000000-0000-0000-0000-000000000001&condition=open_box'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.products).toHaveLength(1);
    expect(mockProductsQuery.current?.or).toHaveBeenCalledTimes(1);
    expect(mockProductsQuery.current?.or.mock.calls[0]?.[0]).toContain(
      'condition.eq.open_box'
    );
    expect(mockProductsQuery.current?.or.mock.calls[0]?.[0]).toContain(
      'condition.eq.refurbished'
    );
    expect(mockProductsQuery.current?.or.mock.calls[0]?.[0]).toContain(
      'available_conditions.cs.{open_box}'
    );
    expect(mockProductsQuery.current?.or.mock.calls[0]?.[0]).toContain(
      'available_conditions.cs.{refurbished}'
    );
  });

  it('returns 500 when the products query fails', async () => {
    mockProductsResult.current = {
      data: null as never,
      error: { message: 'db failure' },
    };

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/products?merchant_id=00000000-0000-0000-0000-000000000001'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Internal server error');
  });
});
