import { describe, expect, it } from 'vitest';
import { buildCompareDiscoveryLinks } from './build-compare-discovery-links';
import { parseCompareSlug } from './compare-slugs';
import {
  CURATED_PRODUCT_COMPARE_LINK_LIMIT,
  MAX_CURATED_COMPARE_LINKS_PER_PRODUCT,
} from './curate-product-compare-pairs';

function product(index: number, price: number) {
  return {
    slug: `phone-${index}`,
    name: `Phone ${index}`,
    brand: `Brand ${index % 5}`,
    price,
    category_slug: 'smartphones',
    product_key_specs: {
      chipset: `Chip ${index}`,
      ram_gb: 8 + index,
      storage_gb: 128 + index,
    },
  };
}

describe('buildCompareDiscoveryLinks curation', () => {
  it('caps each category and prevents one product becoming a compare-page anchor', () => {
    const links = buildCompareDiscoveryLinks({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      includeBrandCompareLinks: false,
      products: Array.from({ length: 40 }, (_, index) =>
        product(index, 200_000 + index * 10_000)
      ),
    });

    expect(links.length).toBeLessThanOrEqual(
      CURATED_PRODUCT_COMPARE_LINK_LIMIT
    );

    const appearances = new Map<string, number>();
    for (const link of links) {
      const parsed = parseCompareSlug(link.canonicalSlug);
      expect(parsed).not.toBeNull();
      if (!parsed) continue;
      appearances.set(
        parsed.leftKey,
        (appearances.get(parsed.leftKey) ?? 0) + 1
      );
      appearances.set(
        parsed.rightKey,
        (appearances.get(parsed.rightKey) ?? 0) + 1
      );
    }

    expect(Math.max(...appearances.values())).toBeLessThanOrEqual(
      MAX_CURATED_COMPARE_LINKS_PER_PRODUCT
    );
  });

  it('prefers similarly priced substitutes over inventory order', () => {
    const links = buildCompareDiscoveryLinks({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      includeBrandCompareLinks: false,
      products: [
        product(0, 200_000),
        product(1, 1_500_000),
        product(2, 210_000),
      ],
    });

    expect(links.map((link) => link.canonicalSlug)).toContain(
      'phone-0-vs-phone-2'
    );
    expect(links[0]?.canonicalSlug).toBe('phone-0-vs-phone-2');
  });
});
