import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateStaticClient, mockMerchantSingle, mockProductOrder } =
  vi.hoisted(() => {
    const mockMerchantSingle = vi.fn();
    const mockProductOrder = vi.fn();
    const mockCreateStaticClient = vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: mockMerchantSingle,
              })),
            })),
          };
        }

        if (table === 'products') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: mockProductOrder,
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    }));

    return {
      mockCreateStaticClient,
      mockMerchantSingle,
      mockProductOrder,
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

vi.mock('@/env', () => ({
  getSupabaseAnonKey: vi.fn(() => 'anon-key'),
  getSupabaseUrl: vi.fn(() => 'https://example.supabase.co'),
}));

vi.mock('@/lib/product-queries', () => ({
  PRODUCT_COLUMNS: 'id,name,images',
}));

vi.mock('@/lib/product-stock', () => ({
  getEffectiveStock: vi.fn(() => 7),
}));

import { GET } from './route';

describe('GET /api/storefront/[slug]/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps string array images to storefront image fields', async () => {
    mockMerchantSingle.mockResolvedValue({
      data: { id: 'merchant-123' },
      error: null,
    });
    mockProductOrder.mockResolvedValue({
      data: [
        {
          id: 'product-123',
          name: 'Test Phone',
          description: 'Fast phone',
          price: 1000,
          compare_at_price: null,
          images: ['https://cdn.example.com/phone.jpg'],
          image_hint: 'phone',
          category: 'Phones',
          brand: 'Test',
          status: 'active',
          has_variants: false,
          slug: 'test-phone',
          sku: 'TP-123',
          manage_stock: false,
          low_stock_threshold: 2,
          color: 'Black',
          condition: 'new',
        },
      ],
      error: null,
    });

    const response = await GET(
      new NextRequest('https://example.com/api/storefront/test-store/products'),
      { params: Promise.resolve({ slug: 'test-store' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.products).toEqual([
      expect.objectContaining({
        id: 'product-123',
        image: 'https://cdn.example.com/phone.jpg',
        imageLarge: 'https://cdn.example.com/phone.jpg',
        stock: 7,
        availability: 'in_stock',
        inventory_policy: 'untracked',
        is_purchasable: true,
        quantity_available: null,
      }),
    ]);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=300, stale-while-revalidate=3600'
    );
  });

  it('returns 404 when the merchant slug does not resolve', async () => {
    mockMerchantSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const response = await GET(
      new NextRequest(
        'https://example.com/api/storefront/missing-store/products'
      ),
      { params: Promise.resolve({ slug: 'missing-store' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Store not found for slug: missing-store');
    expect(mockProductOrder).not.toHaveBeenCalled();
  });
});
