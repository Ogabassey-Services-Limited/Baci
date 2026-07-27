import { describe, expect, it, vi } from 'vitest';
import type { StorefrontProductPurgeEntry } from '@/lib/storefront-product-purge-urls';
import { processBulkUpdateChanges } from './bulk-update-change-processing';

type ProductStatus = 'active' | 'archived' | 'draft';

function createProductRow(id: string, status: ProductStatus) {
  return {
    id,
    slug: `slug-${id}`,
    category: 'Electronics',
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
}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() =>
        createProductQuery(() => ({
          data: [createProductRow('', input.beforeStatus)],
          error: null,
        }))
      ),
      update: vi.fn(() =>
        createProductQuery(() => ({
          data: [createProductRow('', input.afterStatus)],
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
          details: { price: index + 1 },
        } as const)
  );

  await processBulkUpdateChanges({
    changes,
    currency: 'NGN',
    merchantBusinessName: 'Test Store',
    merchantId: 'merchant-1',
    onPurgeEntries: (entries) => purgeEntries.push(...entries),
    supabase: createSupabase(input) as never,
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

  it('emits an entry for an active product field update', async () => {
    await expect(
      processExistingProducts({
        changeType: 'update',
        count: 1,
        beforeStatus: 'active',
        afterStatus: 'active',
      })
    ).resolves.toEqual([
      { slug: 'slug-product-0', categorySegment: 'electronics' },
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
