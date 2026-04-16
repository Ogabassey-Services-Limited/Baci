import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateStaticClient, mockProductsResult } = vi.hoisted(() => {
  const mockProductsResult = {
    current: {
      data: [] as Record<string, unknown>[],
      error: null as { message: string } | null,
    },
  };

  function createProductsQuery() {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      or: vi.fn(() => query),
      gte: vi.fn(() => query),
      lte: vi.fn(() => query),
      order: vi.fn(() => Promise.resolve(mockProductsResult.current)),
    };

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
    color: 'Black',
    has_condition_offers: false,
    available_conditions: ['new'],
    ...overrides,
  };
}

describe('GET /api/storefront/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductsResult.current = {
      data: [],
      error: null,
    };
  });

  it('matches category filters against category slugs as well as names', async () => {
    mockProductsResult.current = {
      data: [
        createRawProduct({ id: 'tv-1', category: 'Smart TVs' }),
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
});
