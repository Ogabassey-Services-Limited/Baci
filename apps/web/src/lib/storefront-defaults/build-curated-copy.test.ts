import { describe, expect, it } from 'vitest';
import { buildCuratedCopy } from './build-curated-copy';
import { forbiddenCuratedStorefrontClaims } from './curated-claim-test-support';

describe('buildCuratedCopy', () => {
  it.each([
    ['fashion', 'styles', 'Collections'],
    ['food', 'menu items', 'Menu'],
    ['electronics', 'devices', 'Gadgets'],
    ['pharmacy', 'health products', 'Health Store'],
    ['unknown-type', 'products', 'Shop'],
  ])('uses the safe profile vocabulary for %s', (businessType, subject, shopNavLabel) => {
    const copy = buildCuratedCopy({
      businessName: 'North Star',
      businessType,
      country: 'Nigeria',
    });
    expect(copy.hero.title).toBe(`Explore ${subject} from North Star`);
    expect(copy.header.navigationLinks[1]).toEqual({
      label: shopNavLabel,
      url: '/products',
    });
    expect(copy.features.title).toBe(`Browse ${subject}`);
    expect(copy.header.navigationLinks).toEqual([
      { label: 'Home', url: '/' },
      expect.objectContaining({ url: '/products' }),
      { label: 'About', url: '/about' },
    ]);
    expect(copy.header.ctaButton).toEqual({
      show: false,
      text: 'Get Started',
      url: '/signup',
    });
    expect(copy.products.title).toBe('Explore products');
    expect(copy.newsletter.title).toBe('Updates from North Star');
    expect(copy.footer.quickLinks).toHaveLength(4);
    expect(copy.features.items).toHaveLength(3);
    const serializedCopy = JSON.stringify(copy).toLowerCase();
    for (const claim of forbiddenCuratedStorefrontClaims)
      expect(serializedCopy).not.toContain(claim);
  });
});
