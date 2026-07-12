import { describe, expect, it } from 'vitest';
import {
  buildCompareLinkGraph,
  COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT,
} from './compare-link-graph';
import {
  buildCategoryCompareGraphSlugSet,
  isMaintainedCompareGraphSlug,
} from './compare-maintained-slug';

const products = [
  {
    id: 'p-xiaomi-13t',
    name: 'Xiaomi 13T',
    slug: 'xiaomi-13t',
    brand: 'Xiaomi',
    price: 450_000,
    status: 'active',
    category_slug: 'smartphones',
    product_key_specs: {
      battery_mah: 5000,
      chipset: 'Dimensity 8200 Ultra',
      ram_gb: 8,
      storage_gb: 256,
    },
  },
  {
    id: 'p-pixel-8',
    name: 'Google Pixel 8',
    slug: 'google-pixel-8',
    brand: 'Google',
    price: 620_000,
    status: 'active',
    category_slug: 'smartphones',
    product_key_specs: {
      battery_mah: 4575,
      chipset: 'Tensor G3',
      ram_gb: 12,
      storage_gb: 128,
    },
  },
  {
    id: 'p-thinkpad',
    name: 'Lenovo ThinkPad X1 Carbon Gen 7',
    slug: 'lenovo-thinkpad-x1-carbon-gen-7',
    brand: 'Lenovo',
    price: 720_000,
    status: 'active',
    category_slug: 'laptops',
    product_key_specs: {
      chipset: 'Intel Core i7-8665U',
      display_size_inches: 14,
      ram_gb: 16,
      storage_gb: 512,
    },
  },
  {
    id: 'p-dell-14-plus',
    name: 'Dell 14 Plus 2-in-1',
    slug: 'dell-14-plus-2-in-1',
    brand: 'Dell',
    price: 830_000,
    status: 'active',
    category_slug: 'laptops',
    product_key_specs: {
      chipset: 'Intel Core Ultra 7',
      display_size_inches: 14.5,
      ram_gb: 32,
      storage_gb: 1024,
    },
  },
  {
    id: 'p-hidden',
    name: 'Hidden Demo',
    slug: 'hidden-demo',
    brand: 'Demo',
    price: 1,
    status: 'draft',
    category_slug: 'smartphones',
    product_key_specs: {},
  },
];

describe('isMaintainedCompareGraphSlug', () => {
  it('keeps category-window graph links indexable up to the compare index limit', () => {
    const categoryProducts = Array.from({ length: 90 }, (_, index) => ({
      id: `p-phone-${index}`,
      name: `Phone ${index}`,
      slug: `phone-${index}`,
      brand: `Brand ${index % 4}`,
      price: 250_000 + index,
      status: 'active',
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: `Chip ${index}`,
        ram_gb: 4 + index,
        storage_gb: 64 + index,
      },
    }));
    const graph = buildCompareLinkGraph({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products: categoryProducts,
      maxLinks: COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT,
    });
    const deepGraphEntry = graph[60];

    expect(graph.length).toBe(COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT);
    expect(deepGraphEntry).toBeDefined();
    expect(
      isMaintainedCompareGraphSlug({
        storeUrl: 'https://ogabassey.com',
        categorySlug: 'smartphones',
        categoryName: 'Smartphones',
        products: categoryProducts,
        comparisonSlug: deepGraphEntry?.comparisonSlug ?? '',
      })
    ).toBe(true);
  });

  it('buildCategoryCompareGraphSlugSet matches the unanchored graph slugs', () => {
    const input = {
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products,
    };
    const graph = buildCompareLinkGraph({
      ...input,
      maxLinks: COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT,
    });
    const slugSet = buildCategoryCompareGraphSlugSet(input);

    expect(new Set(slugSet)).toEqual(
      new Set(graph.map((entry) => entry.comparisonSlug))
    );
  });

  it('uses a precomputed categoryGraphSlugs set for the O(1) membership check', () => {
    const input = {
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products,
    };
    const memberSlug = buildCategoryCompareGraphSlugSet(input)[0];

    // A member of the precomputed set is maintained without rebuilding it.
    expect(
      isMaintainedCompareGraphSlug({
        ...input,
        comparisonSlug: memberSlug,
        categoryGraphSlugs: new Set([memberSlug]),
      })
    ).toBe(true);
    // ...and a non-member with an empty set + no anchor match is rejected.
    expect(
      isMaintainedCompareGraphSlug({
        ...input,
        comparisonSlug: 'nonexistent-left-vs-nonexistent-right',
        categoryGraphSlugs: new Set<string>(),
      })
    ).toBe(false);
  });

  it('rejects a precomputed slug whose product is no longer active in the route products', () => {
    const input = {
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products,
    };
    const staleSlug = 'google-pixel-8-vs-xiaomi-13t';

    // The precomputed set still contains the slug, but xiaomi-13t has
    // since been unpublished (draft) — the set outlived the inventory refresh.
    // The warm hit must NOT keep the page maintained: the pair's product is no
    // longer active in the current route products, and the anchored fallback
    // (status-filtered) can't approve it either.
    const staleRouteProducts = products.map((product) =>
      product.slug === 'xiaomi-13t' ? { ...product, status: 'draft' } : product
    );

    expect(
      isMaintainedCompareGraphSlug({
        ...input,
        products: staleRouteProducts,
        comparisonSlug: staleSlug,
        categoryGraphSlugs: new Set([staleSlug]),
      })
    ).toBe(false);
  });

  it('still approves an anchored-reachable slug missing from the precomputed set', () => {
    const input = {
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products,
    };

    // The canonical pair is a real, anchored-reachable comparison for these two
    // active products, but is deliberately absent from the precomputed category
    // set (mirroring a clicked product outside the bounded inventory the cached
    // set was built from). The cheap per-URL anchored fallback (leftKey/rightKey,
    // maxLinks:8 over `products`) must still approve it — the O(1) set membership
    // is an additive fast-path, not a replacement for the anchored check.
    expect(
      isMaintainedCompareGraphSlug({
        ...input,
        comparisonSlug: 'google-pixel-8-vs-xiaomi-13t',
        categoryGraphSlugs: new Set<string>(),
      })
    ).toBe(true);
  });
});
