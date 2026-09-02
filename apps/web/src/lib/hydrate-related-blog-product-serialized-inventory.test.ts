import { describe, expect, it, vi } from 'vitest';

const mockHydrate = vi.fn();

vi.mock('@/lib/hydrate-public-products', () => ({
  hydrateAndSanitizePublicProducts: (...args: unknown[]) =>
    mockHydrate(...args),
}));

import { hydrateRelatedBlogProductSerializedInventory } from './hydrate-related-blog-product-serialized-inventory';

describe('hydrateRelatedBlogProductSerializedInventory', () => {
  it('marks a serialized variant rail purchasable from canonical public units', async () => {
    const products = [
      {
        id: 'product-1',
        name: 'iPad 10',
        slug: 'ipad-10',
        category_slug: 'tablets',
        has_variants: true,
        variants: [
          {
            id: 'variant-1',
            inventory_tracking_policy: 'serialized_strict',
            stock_quantity: 1,
          },
        ],
      },
    ];
    mockHydrate.mockResolvedValue(products);

    const result = await hydrateRelatedBlogProductSerializedInventory(
      {} as never,
      'merchant-1',
      products
    );

    expect(result[0]?.has_purchasable_variant).toBe(true);
    expect(mockHydrate).toHaveBeenCalledWith({}, 'merchant-1', products);
  });

  it('marks a serialized variant rail unavailable when canonical units are zero', async () => {
    const products = [
      {
        id: 'product-2',
        name: 'iPad 10',
        slug: 'ipad-10',
        category_slug: 'tablets',
        has_variants: true,
        variants: [
          {
            id: 'variant-2',
            inventory_tracking_policy: 'serialized_strict',
            stock_quantity: 0,
          },
        ],
      },
    ];
    mockHydrate.mockResolvedValueOnce(products);

    const result = await hydrateRelatedBlogProductSerializedInventory(
      {} as never,
      'merchant-1',
      products
    );

    expect(result[0]?.has_purchasable_variant).toBe(false);
  });
});
