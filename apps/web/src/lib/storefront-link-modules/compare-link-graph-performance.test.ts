import { describe, expect, it } from 'vitest';
import { buildCompareLinkGraph } from './compare-link-graph';

describe('buildCompareLinkGraph performance bounds', () => {
  it('bounds unanchored candidate generation for small link modules', () => {
    const boundedProducts = [
      {
        id: 'p-anchor-phone',
        name: 'Anchor Phone',
        slug: 'anchor-phone',
        brand: 'Anchor',
        price: 300_000,
        status: 'active',
        category_slug: 'smartphones',
        product_key_specs: {
          chipset: 'Anchor Chip',
          ram_gb: 8,
          storage_gb: 256,
        },
      },
      ...Array.from({ length: 70 }, (_, index) => ({
        id: `p-window-${index}`,
        name: `ZZZ Window Phone ${index}`,
        slug: `zzz-window-phone-${index}`,
        brand: 'Window',
        price: 310_000 + index,
        status: 'active',
        category_slug: 'smartphones',
        product_key_specs: {
          chipset: `Window Chip ${index}`,
          ram_gb: 4 + index,
          storage_gb: 64 + index,
        },
      })),
      {
        id: 'p-deep-alpha',
        name: 'AAA Deep Phone',
        slug: 'aaa-deep-phone',
        brand: 'Alpha',
        price: 999_999,
        status: 'active',
        category_slug: 'smartphones',
        product_key_specs: {
          battery_mah: 7000,
          chipset: 'Alpha Chip',
          display_size_inches: 6.9,
          ram_gb: 24,
          storage_gb: 1024,
        },
      },
    ];

    const graph = buildCompareLinkGraph({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products: boundedProducts,
      maxLinks: 6,
    });

    expect(graph).toHaveLength(6);
    expect(graph.some((entry) => entry.href.includes('aaa-deep-phone'))).toBe(
      false
    );
  });
});
