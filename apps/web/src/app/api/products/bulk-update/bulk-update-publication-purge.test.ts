import { describe, expect, it, vi } from 'vitest';
import type { StorefrontProductPurgeEntry } from '@/lib/storefront-product-purge-urls';
import { processBulkUpdateChanges } from './bulk-update-change-processing';

type ProductStatus = 'active' | 'archived' | 'draft';

function createProductRow(id: string, status: ProductStatus, category: string) {
  return {
    id,
    slug: `slug-${id}`,
    category,
    status,
    categories: null,
    product_categories: [],
  };
}

function createProductQuery(result: () => { data: unknown; error: null }) {
  const query: Record<string, unknown> = {};
  let productId = '';
  query.eq = vi.fn((column: string, value: string) => {
    if (column === 'id') productId = value;
    return query;
  });
  query.select = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => resultFor(productId));
  // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
  query.then = vi.fn((resolve: (value: unknown) => void) =>
    resolve(resultFor(productId))
  );

  function resultFor(id: string) {
    const resolved = result();
    if (!Array.isArray(resolved.data)) {
      return {
        ...resolved,
        data:
          typeof resolved.data === 'object' && resolved.data !== null
            ? { ...resolved.data, id, slug: `slug-${id}` }
            : resolved.data,
      };
    }
    return {
      ...resolved,
      data: resolved.data.map((row) =>
        typeof row === 'object' && row !== null
          ? { ...row, id, slug: `slug-${id}` }
          : row
      ),
    };
  }

  return query;
}

function createSupabase(input: {
  beforeStatus: ProductStatus;
  afterStatus: ProductStatus;
  beforeCategory: string;
  afterCategory: string;
}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() =>
        createProductQuery(() => ({
          data: [
            createProductRow('', input.beforeStatus, input.beforeCategory),
          ],
          error: null,
        }))
      ),
      update: vi.fn(() =>
        createProductQuery(() => ({
          data: [createProductRow('', input.afterStatus, input.afterCategory)],
          error: null,
        }))
      ),
    })),
  };
}

async function processExistingProducts(input: {
  changeType: 'remove' | 'update';
  count: number;
  beforeStatus: ProductStatus;
  afterStatus: ProductStatus;
  beforeCategory?: string;
  afterCategory?: string;
}) {
  const purgeEntries: StorefrontProductPurgeEntry[] = [];
  const changes = Array.from({ length: input.count }, (_, index) =>
    input.changeType === 'remove'
      ? ({
          type: 'remove' as const,
          productId: `product-${index}`,
          details: { price: index + 1 },
        } as const)
      : ({
          type: 'update' as const,
          productId: `product-${index}`,
          newPrice: index + 1,
          details: {
            price: index + 1,
            category: input.afterCategory ?? 'Electronics',
          },
        } as const)
  );

  await processBulkUpdateChanges({
    changes,
    currency: 'NGN',
    merchantBusinessName: 'Test Store',
    merchantId: 'merchant-1',
    onPurgeEntries: (entries) => purgeEntries.push(...entries),
    supabase: createSupabase({
      ...input,
      beforeCategory: input.beforeCategory ?? 'Electronics',
      afterCategory: input.afterCategory ?? 'Electronics',
    }) as never,
  });

  return purgeEntries;
}

describe('bulk update public purge entries', () => {
  it('does not emit entries for 51 draft-only updates', async () => {
    await expect(
      processExistingProducts({
        changeType: 'update',
        count: 51,
        beforeStatus: 'draft',
        afterStatus: 'draft',
      })
    ).resolves.toEqual([]);
  });

  it('does not emit entries for 51 draft removals', async () => {
    await expect(
      processExistingProducts({
        changeType: 'remove',
        count: 51,
        beforeStatus: 'draft',
        afterStatus: 'archived',
      })
    ).resolves.toEqual([]);
  });

  it('emits previous and new entries for an active product category update', async () => {
    await expect(
      processExistingProducts({
        changeType: 'update',
        count: 1,
        beforeStatus: 'active',
        afterStatus: 'active',
        beforeCategory: 'Electronics',
        afterCategory: 'Books',
      })
    ).resolves.toEqual([
      { slug: 'slug-product-0', categorySegment: 'electronics' },
      { slug: 'slug-product-0', categorySegment: 'books' },
    ]);
  });

  it('emits the previous public entry for active-to-archive removal', async () => {
    await expect(
      processExistingProducts({
        changeType: 'remove',
        count: 1,
        beforeStatus: 'active',
        afterStatus: 'archived',
      })
    ).resolves.toEqual([
      { slug: 'slug-product-0', categorySegment: 'electronics' },
    ]);
  });
});
