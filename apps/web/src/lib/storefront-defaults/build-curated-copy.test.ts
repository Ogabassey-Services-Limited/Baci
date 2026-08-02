import { describe, expect, it } from 'vitest';
import { buildCuratedCopy } from './build-curated-copy';

describe('buildCuratedCopy', () => {
  it.each([
    ['fashion', 'styles'],
    ['food', 'menu items'],
    ['electronics', 'devices'],
    ['pharmacy', 'health products'],
    ['unknown-type', 'products'],
  ])('returns category-specific neutral copy for %s', (businessType, subject) => {
    const copy = buildCuratedCopy({
      businessName: 'North Star',
      businessType,
      country: 'Nigeria',
    });
    expect(copy.hero.title).toBe(`Explore ${subject} from North Star`);
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
    expect(JSON.stringify(copy).toLowerCase()).not.toMatch(
      /delivery|trusted|quality|secure|reliable|warranty|expert|confidence/
    );
  });
});
