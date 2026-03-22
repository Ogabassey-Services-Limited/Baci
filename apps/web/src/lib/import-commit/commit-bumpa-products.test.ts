import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commitBumpaProducts } from '@/lib/import-commit/commit-bumpa-products';

function createProduct(overrides?: Partial<Record<string, unknown>>) {
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
  } as never;
}

describe('commitBumpaProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates existing imported products and inserts new ones with unique slugs', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      range: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
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
  });
});
