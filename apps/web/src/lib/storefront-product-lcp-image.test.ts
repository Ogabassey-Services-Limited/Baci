import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCachedDataTestHarness,
  type CachedDataTestHarness,
  resetMockCreateClient,
} from '@/lib/cached-data.test-utils';
import { getCachedStorefrontProductLcpImage } from '@/lib/storefront-product-lcp-image';

vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('react', () => ({ cache: vi.fn((fn) => fn) }));
vi.mock('@supabase/supabase-js', async () => {
  const { getMockCreateClient } = await import('@/lib/cached-data.test-utils');
  return {
    createClient: (...args: unknown[]) => {
      const createClient = getMockCreateClient();
      if (!createClient) {
        return {
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn(),
                single: vi.fn(),
                eq: vi.fn(),
              }),
            }),
          }),
          auth: { getUser: vi.fn() },
        };
      }
      return createClient(...args);
    },
  };
});

let harness: CachedDataTestHarness;

beforeEach(() => {
  harness = buildCachedDataTestHarness();
});

afterEach(() => {
  resetMockCreateClient();
  vi.restoreAllMocks();
});

describe('getCachedStorefrontProductLcpImage', () => {
  it('returns the first product image using a minimal explicit projection', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'product-123',
        slug: 'lenovo-legion',
        images: [
          'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif',
        ],
      },
      error: null,
    });

    await expect(
      getCachedStorefrontProductLcpImage('merchant-123', 'Lenovo-Legion')
    ).resolves.toBe(
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif'
    );

    expect(harness.mockFrom).toHaveBeenCalledWith('products');
    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('status', 'active');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'lenovo-legion');
    const selectArg = String(harness.mockSelect.mock.calls.at(-1)?.[0]);
    expect(selectArg).toContain('images');
    expect(selectArg).not.toContain('product_key_specs');
    expect(selectArg).not.toContain('product_offers');
  });

  it('supports image objects with url fields', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'product-123',
        slug: 'lenovo-legion',
        images: [
          {
            url: 'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif',
            alt: 'Lenovo Legion',
          },
        ],
      },
      error: null,
    });

    await expect(
      getCachedStorefrontProductLcpImage('merchant-123', 'lenovo-legion')
    ).resolves.toBe(
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif'
    );
  });

  it('supports direct string image values', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'product-123',
        slug: 'lenovo-legion',
        images:
          'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif',
      },
      error: null,
    });

    await expect(
      getCachedStorefrontProductLcpImage('merchant-123', 'lenovo-legion')
    ).resolves.toBe(
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif'
    );
  });

  it('uses the UUID lookup when the product route segment is a UUID', async () => {
    const productId = '11111111-1111-4111-8111-111111111111';
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: productId,
        slug: 'lenovo-legion',
        images: [
          'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif',
        ],
      },
      error: null,
    });

    await expect(
      getCachedStorefrontProductLcpImage('merchant-123', productId)
    ).resolves.toBe(
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif'
    );

    expect(harness.mockOr).toHaveBeenCalledWith(
      `slug.eq.${productId},id.eq.${productId}`
    );
  });

  it('returns null when no usable image is available', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'product-123',
        slug: 'lenovo-legion',
        images: [],
      },
      error: null,
    });

    await expect(
      getCachedStorefrontProductLcpImage('merchant-123', 'lenovo-legion')
    ).resolves.toBeNull();
  });

  it('returns null when the product image query returns no product', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(
      getCachedStorefrontProductLcpImage('merchant-123', 'lenovo-legion')
    ).resolves.toBeNull();

    expect(harness.mockFrom).toHaveBeenCalledWith('products');
    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('status', 'active');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'lenovo-legion');
    expect(harness.mockSelect).toHaveBeenCalled();
  });

  it('skips blank image values and returns the first usable URL', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'product-123',
        slug: 'lenovo-legion',
        images: ['', 'https://cdn.ogabassey.com/valid-url.jpg'],
      },
      error: null,
    });

    await expect(
      getCachedStorefrontProductLcpImage('merchant-123', 'lenovo-legion')
    ).resolves.toBe('https://cdn.ogabassey.com/valid-url.jpg');

    expect(harness.mockFrom).toHaveBeenCalledWith('products');
    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('status', 'active');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'lenovo-legion');
    expect(harness.mockSelect).toHaveBeenCalled();
  });

  it('returns null when image objects have no URL', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'product-123',
        slug: 'lenovo-legion',
        images: [{ alt: 'Lenovo Legion' }],
      },
      error: null,
    });

    await expect(
      getCachedStorefrontProductLcpImage('merchant-123', 'lenovo-legion')
    ).resolves.toBeNull();

    expect(harness.mockFrom).toHaveBeenCalledWith('products');
    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('status', 'active');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'lenovo-legion');
    expect(harness.mockSelect).toHaveBeenCalled();
  });

  it('returns null when image object URLs are blank', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'product-123',
        slug: 'lenovo-legion',
        images: [{ url: '  ' }],
      },
      error: null,
    });

    await expect(
      getCachedStorefrontProductLcpImage('merchant-123', 'lenovo-legion')
    ).resolves.toBeNull();

    expect(harness.mockFrom).toHaveBeenCalledWith('products');
    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('status', 'active');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'lenovo-legion');
    expect(harness.mockSelect).toHaveBeenCalled();
  });

  it('returns null when the product image query fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('boom'),
    });

    await expect(
      getCachedStorefrontProductLcpImage('merchant-123', 'lenovo-legion')
    ).resolves.toBeNull();

    expect(harness.mockFrom).toHaveBeenCalledWith('products');
    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(harness.mockEq).toHaveBeenCalledWith('status', 'active');
    expect(harness.mockEq).toHaveBeenCalledWith('slug', 'lenovo-legion');
    expect(harness.mockSelect).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching product LCP image:',
      'lenovo-legion',
      expect.any(Error)
    );
  });
});
