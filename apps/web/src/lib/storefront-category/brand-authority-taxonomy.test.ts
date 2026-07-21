import { describe, expect, it } from 'vitest';
import { brandAuthorityTaxonomy } from '@/lib/storefront-category/brand-authority-taxonomy';

function makeProducts(brand: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    slug: `${brand.toLowerCase()}-${index}`,
    name: `${brand} ${index}`,
    brand,
    price: 100_000 + index,
  }));
}

describe('brand authority taxonomy', () => {
  it('resolves only curated category and brand pairs', () => {
    expect(
      brandAuthorityTaxonomy.getEntry('smartphones', 'Google')
    ).toMatchObject({
      brandKey: 'google',
      displayName: 'Google Pixel',
    });
    expect(brandAuthorityTaxonomy.getEntry('laptops', 'samsung')).toBeNull();
    expect(
      brandAuthorityTaxonomy.getEntry('smartphones', 'unknown')
    ).toBeNull();
  });

  it('keeps only brands with enough category inventory', () => {
    const eligible = brandAuthorityTaxonomy.getEligibleEntries('smartphones', [
      ...makeProducts('Samsung', 5),
      ...makeProducts('Tecno', 4),
      ...makeProducts('Google', 6),
    ]);

    expect(eligible).toEqual([
      expect.objectContaining({ brandKey: 'samsung', productCount: 5 }),
      expect.objectContaining({ brandKey: 'google', productCount: 6 }),
    ]);
  });
});
