import { describe, expect, it } from 'vitest';
import { buildCompareLinkGraph } from '@/lib/storefront-link-modules/compare-link-graph';
import { buildCategoryCompareGraphSlugSet } from '@/lib/storefront-link-modules/compare-maintained-slug';
import { PDP_SEMANTIC_INVENTORY_LIMIT } from '@/lib/storefront-product/pdp-semantic-inventory-limit';
import { getMaintainedCompareRouteManifest } from './get-maintained-compare-route-manifest';

const products = Array.from({ length: 90 }, (_, index) => ({
  slug: `phone-${index}`,
  name: `Phone ${index}`,
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

describe('getMaintainedCompareRouteManifest', () => {
  it('unifies discovery, category-graph, and anchored graph route approvals', () => {
    const input = {
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products,
      curatedSlugs: new Set(['phone-0-vs-phone-1']),
    };
    const categoryGraphSlugs = new Set(buildCategoryCompareGraphSlugSet(input));
    const anchoredSlug = products
      .flatMap((product) =>
        buildCompareLinkGraph({
          ...input,
          anchorProductSlug: product.slug,
          maxLinks: 8,
          products: [
            product,
            ...products
              .filter((candidate) => candidate.slug !== product.slug)
              .slice(0, PDP_SEMANTIC_INVENTORY_LIMIT),
          ],
          productsAreKnownActive: true,
        }).map((entry) => entry.comparisonSlug)
      )
      .find((slug) => !categoryGraphSlugs.has(slug));

    expect(anchoredSlug).toBeDefined();

    const manifest = getMaintainedCompareRouteManifest(input);

    expect(manifest).toEqual(
      expect.objectContaining({
        has: expect.any(Function),
      })
    );
    expect(manifest.has('phone-0-vs-phone-1')).toBe(true);
    expect(manifest.has([...categoryGraphSlugs][0] ?? '')).toBe(true);
    expect(manifest.has(anchoredSlug ?? '')).toBe(true);
  });

  it('includes links emitted from the bounded PDP inventory when a category has more than 48 products', () => {
    const boundedProducts = Array.from({ length: 70 }, (_, index) => ({
      slug: `bounded-phone-${index}`,
      name: `Bounded Phone ${index}`,
      brand: index > PDP_SEMANTIC_INVENTORY_LIMIT ? 'Premium' : null,
      price: index > PDP_SEMANTIC_INVENTORY_LIMIT ? 500_000 + index : null,
      status: 'active',
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: `Chip ${index}`,
        ram_gb: 4 + index,
        storage_gb: 64 + index,
      },
    }));
    const input = {
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products: boundedProducts,
      curatedSlugs: new Set<string>(),
    };
    const anchor = boundedProducts[0];
    const pdpProducts = [
      anchor,
      ...boundedProducts
        .filter((product) => product.slug !== anchor.slug)
        .slice(0, PDP_SEMANTIC_INVENTORY_LIMIT),
    ];
    const pdpSlugs = buildCompareLinkGraph({
      ...input,
      anchorProductSlug: anchor.slug,
      maxLinks: 8,
      products: pdpProducts,
      productsAreKnownActive: true,
    }).map((entry) => entry.comparisonSlug);

    expect(pdpSlugs).toHaveLength(8);

    const manifest = getMaintainedCompareRouteManifest(input);

    for (const slug of pdpSlugs) {
      expect(manifest.has(slug)).toBe(true);
    }
  });
});
