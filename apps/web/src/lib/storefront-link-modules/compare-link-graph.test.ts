import { describe, expect, it } from 'vitest';
import {
  buildCategoryCompareGraphSlugSet,
  buildCompareLinkGraph,
  COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT,
  isMaintainedCompareGraphSlug,
} from './compare-link-graph';

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

describe('buildCompareLinkGraph', () => {
  it('builds curated same-category comparison links for active products only', () => {
    const graph = buildCompareLinkGraph({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products,
      maxLinks: 10,
    });

    expect(graph.map((entry) => entry.href)).toContain(
      '/smartphones/compare/google-pixel-8-vs-xiaomi-13t'
    );
    expect(graph.some((entry) => entry.href.includes('hidden-demo'))).toBe(
      false
    );
    expect(
      graph.some((entry) => entry.href.includes('/laptops/compare/'))
    ).toBe(false);
  });

  it('uses canonical pair order for labels, descriptions, and product metadata', () => {
    const graph = buildCompareLinkGraph({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products: [products[0], products[1]],
      maxLinks: 1,
    });

    expect(graph[0]).toMatchObject({
      comparisonSlug: 'google-pixel-8-vs-xiaomi-13t',
      label: 'Compare Google Pixel 8 with Xiaomi 13T',
      productSlugs: ['google-pixel-8', 'xiaomi-13t'],
      productNames: ['Google Pixel 8', 'Xiaomi 13T'],
    });
    expect(graph[0]?.description).toContain('Google Pixel 8 and Xiaomi 13T');
  });

  it('supports the dominant Semrush compare clusters', () => {
    const smartphoneGraph = buildCompareLinkGraph({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products,
      anchorProductSlug: 'xiaomi-13t',
      maxLinks: 8,
    });
    const laptopGraph = buildCompareLinkGraph({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'laptops',
      categoryName: 'Laptops',
      products,
      anchorProductSlug: 'lenovo-thinkpad-x1-carbon-gen-7',
      maxLinks: 8,
    });

    expect(smartphoneGraph.map((entry) => entry.href)).toContain(
      '/smartphones/compare/google-pixel-8-vs-xiaomi-13t'
    );
    expect(laptopGraph.map((entry) => entry.href)).toContain(
      '/laptops/compare/dell-14-plus-2-in-1-vs-lenovo-thinkpad-x1-carbon-gen-7'
    );
  });

  it('supports active-only SEO inventory that does not carry a status column', () => {
    const graph = buildCompareLinkGraph({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products: products
        .filter(
          (product) =>
            product.category_slug === 'smartphones' &&
            product.status === 'active'
        )
        .map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          price: product.price,
          category_slug: product.category_slug,
          product_key_specs: product.product_key_specs,
        })),
      productsAreKnownActive: true,
      maxLinks: 8,
    });

    expect(graph.map((entry) => entry.href)).toContain(
      '/smartphones/compare/google-pixel-8-vs-xiaomi-13t'
    );
  });

  it('keeps deep anchor products in the shared curated approval window', () => {
    const fillerProducts = Array.from({ length: 170 }, (_, index) => ({
      id: `p-filler-${index}`,
      name: `Filler Phone ${index}`,
      slug: `filler-phone-${index}`,
      brand: 'Filler',
      price: 300_000 + index,
      status: 'active',
      category_slug: 'smartphones',
      product_key_specs: {
        battery_mah: 5000,
        chipset: 'Dimensity 8200 Ultra',
        ram_gb: 8,
        storage_gb: 256,
      },
    }));

    const graph = buildCompareLinkGraph({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products: [...fillerProducts, products[0], products[1]],
      anchorProductSlug: 'xiaomi-13t',
      maxLinks: 8,
    });

    expect(graph.map((entry) => entry.href)).toContain(
      '/smartphones/compare/google-pixel-8-vs-xiaomi-13t'
    );
  });

  it('excludes the current compare page from sibling links and caps output', () => {
    const graph = buildCompareLinkGraph({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products,
      anchorProductSlug: 'xiaomi-13t',
      currentComparisonSlug: 'google-pixel-8-vs-xiaomi-13t',
      maxLinks: 1,
    });

    expect(graph).toHaveLength(0);
    expect(
      graph.some(
        (entry) => entry.comparisonSlug === 'google-pixel-8-vs-xiaomi-13t'
      )
    ).toBe(false);
  });

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

    // A member of the cached set is maintained WITHOUT rebuilding the graph...
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
});
