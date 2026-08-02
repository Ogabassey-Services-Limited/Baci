import { describe, expect, it } from 'vitest';
import { buildCuratedStorefront } from './build-curated-storefront';

describe('curated starter claim safety', () => {
  it.each([
    'fashion',
    'food',
    'electronics',
    'pharmacy',
    'unknown-type',
  ])('keeps %s copy merchant-specific and claim-safe', (businessType) => {
    const storefront = buildCuratedStorefront({
      businessName: 'North Star',
      businessType,
      country: 'Nigeria',
      brandColors: {
        primary: '#111111',
        background: '#ffffff',
        accent: '#f97316',
      },
    });
    const content = JSON.stringify(storefront).toLowerCase();
    expect(content).toContain('north star');
    expect(
      storefront.content.filter(
        (block) => block.type === 'Hero' && block.props?.headingLevel === 'h1'
      )
    ).toHaveLength(1);
    for (const claim of [
      'nationwide delivery',
      'flexible payment',
      'trusted quality',
      'best seller',
      'expert',
      'warranty',
    ])
      expect(content).not.toContain(claim);
  });
});
