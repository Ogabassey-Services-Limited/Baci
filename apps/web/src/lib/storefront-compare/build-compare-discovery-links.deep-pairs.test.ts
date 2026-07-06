import { describe, expect, it } from 'vitest';
import {
  buildCompareDiscoveryLinks,
  PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT,
} from './build-compare-discovery-links';

describe('buildCompareDiscoveryLinks required product pairs', () => {
  it('keeps required product pairs inside the bounded product-scoped discovery window', () => {
    const largeProducts = Array.from(
      { length: PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT + 2 },
      (_, index) => ({
        slug: `laptop-${index}`,
        name: `Laptop ${index}`,
        brand: `Brand ${index % 4}`,
        price: 500_000 + index,
        category_slug: 'laptops',
        product_key_specs: {
          chipset: `Chip ${index}`,
          ram_gb: 8 + index,
          storage_gb: 128 + index,
        },
      })
    );
    const requiredLeft =
      largeProducts[PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT];
    const requiredRight =
      largeProducts[PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT + 1];
    const links = buildCompareDiscoveryLinks({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'laptops',
      categoryName: 'Laptops',
      products: largeProducts,
      requiredProductSlugs: [requiredLeft.slug, requiredRight.slug],
    });

    expect(links.map((link) => link.canonicalSlug)).toContain(
      `${requiredLeft.slug}-vs-${requiredRight.slug}`
    );
  });
});
