import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRevalidateProducts = vi.fn();
vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: (...args: unknown[]) => mockRevalidateProducts(...args),
}));

import { commitBumpaProducts } from '@/lib/import-commit/commit-bumpa-products';
import type { NormalizedImportedProduct } from '@/lib/imports/bumpa/bumpa-types';

function createProduct(
  overrides: Partial<NormalizedImportedProduct> = {}
): NormalizedImportedProduct {
  return {
    sourcePlatform: 'bumpa',
    externalSourceId: 'prod-1',
    title: 'Imported Phone',
    description: 'Premium device',
    sku: 'SKU-1',
    price: 150000,
    currency: 'NGN',
    stock: 5,
    manageStock: true,
    status: 'active',
    images: ['https://example.com/phone.jpg'],
    category: 'Phones',
    sourceCreatedAt: '2026-01-01T00:00:00.000Z',
    sourceUpdatedAt: '2026-02-01T00:00:00.000Z',
    importMetadata: { source: 'bumpa' },
    ...overrides,
  };
}

describe('commitBumpaProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates existing imported products and inserts new ones with unique slugs', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.order.mockReturnValue(loadQuery);
    loadQuery.range.mockResolvedValue({
      data: [
        {
          id: 'existing-product',
          slug: 'imported-phone',
          external_source: 'bumpa',
          external_id: 'prod-1',
        },
        {
          id: 'other-product',
          slug: 'fresh-phone',
          external_source: null,
          external_id: null,
        },
      ],
      error: null,
    });

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockResolvedValue({ error: null });

    const insertQuery = {
      insert: vi.fn(),
    };
    insertQuery.insert.mockResolvedValue({ error: null });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(insertQuery),
    } as unknown as SupabaseClient;

    const result = await commitBumpaProducts({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      products: [
        createProduct(),
        createProduct({
          externalSourceId: 'prod-2',
          title: 'Fresh Phone',
          sku: 'SKU-2',
        }),
      ],
    });

    expect(result).toEqual({
      createdProducts: 1,
      updatedProducts: 1,
    });
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        external_id: 'prod-1',
        slug: 'imported-phone',
      })
    );
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        external_id: 'prod-2',
        slug: 'fresh-phone-2',
      })
    );
    // Imported products must invalidate product caches (incl. the proxy
    // crawl-budget slug-set) so their PDPs aren't hard-404ed until TTL expiry.
    expect(mockRevalidateProducts).toHaveBeenCalledWith('merchant-1');
  });

  it('still succeeds when cache revalidation throws (best-effort, non-fatal)', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.order.mockReturnValue(loadQuery);
    loadQuery.range.mockResolvedValue({ data: [], error: null });

    const insertQuery = { insert: vi.fn() };
    insertQuery.insert.mockResolvedValue({ error: null });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(insertQuery),
    } as unknown as SupabaseClient;

    // A background import worker can lack a Next request/store context, so
    // revalidateTag throws synchronously there — the import must not break.
    mockRevalidateProducts.mockImplementationOnce(() => {
      throw new Error('static generation store missing');
    });

    const result = await commitBumpaProducts({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      products: [createProduct()],
    });

    expect(result).toEqual({ createdProducts: 1, updatedProducts: 0 });
    expect(mockRevalidateProducts).toHaveBeenCalledWith('merchant-1');
    expect(consoleSpy).toHaveBeenCalled();
    // Restore so the suppressed console.error doesn't leak into later tests
    // (the suite uses clearAllMocks, which does not restore spy implementations).
    consoleSpy.mockRestore();
  });

  it('throws when loading existing products fails', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.order.mockReturnValue(loadQuery);
    loadQuery.range.mockResolvedValue({
      data: null,
      error: { message: 'load failed' },
    });

    const supabase = {
      from: vi.fn().mockReturnValue(loadQuery),
    } as unknown as SupabaseClient;

    await expect(
      commitBumpaProducts({
        supabase,
        merchantId: 'merchant-1',
        importJobId: 'job-1',
        products: [createProduct()],
      })
    ).rejects.toThrow('Failed to load existing products: load failed');
  });

  it('throws when updating an imported product fails', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.order.mockReturnValue(loadQuery);
    loadQuery.range.mockResolvedValue({
      data: [
        {
          id: 'existing-product',
          slug: 'imported-phone',
          external_source: 'bumpa',
          external_id: 'prod-1',
        },
      ],
      error: null,
    });

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockResolvedValue({
      error: { message: 'update failed' },
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(updateQuery),
    } as unknown as SupabaseClient;

    await expect(
      commitBumpaProducts({
        supabase,
        merchantId: 'merchant-1',
        importJobId: 'job-1',
        products: [createProduct()],
      })
    ).rejects.toThrow('Failed to update imported product: update failed');
  });

  it('throws when inserting a new imported product fails', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.order.mockReturnValue(loadQuery);
    loadQuery.range.mockResolvedValue({
      data: [],
      error: null,
    });

    const insertQuery = {
      insert: vi.fn(),
    };
    insertQuery.insert.mockResolvedValue({
      error: { message: 'insert failed' },
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(insertQuery),
    } as unknown as SupabaseClient;

    await expect(
      commitBumpaProducts({
        supabase,
        merchantId: 'merchant-1',
        importJobId: 'job-1',
        products: [createProduct()],
      })
    ).rejects.toThrow('Failed to create imported product: insert failed');
  });
});
