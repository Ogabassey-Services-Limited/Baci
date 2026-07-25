import { describe, expect, it } from 'vitest';
import { buildCategoryCompareGraphSlugSet } from '@/lib/storefront-link-modules/compare-maintained-slug';
import { buildCompareLinkGraph } from '@/lib/storefront-link-modules/compare-link-graph';
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
});
