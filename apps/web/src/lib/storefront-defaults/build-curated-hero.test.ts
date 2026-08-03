import { describe, expect, it } from 'vitest';
import { buildCuratedCopy } from './build-curated-copy';
import { buildCuratedHero } from './build-curated-hero';

describe('buildCuratedHero', () => {
  it.each([
    'fashion',
    'food',
    'electronics',
    'pharmacy',
    'unknown-type',
  ])('returns a media-free H1 hero for %s', (businessType) => {
    const copy = buildCuratedCopy({
      businessName: 'North Star',
      businessType,
      country: 'Nigeria',
    });
    const hero = buildCuratedHero(businessType, copy.hero);
    expect(hero).toMatchObject({
      id: 'Hero-home',
      headingLevel: 'h1',
      ctaText: 'Explore products',
      ctaLink: '#products',
    });
    expect(hero).not.toHaveProperty('backgroundImage');
    expect(hero.backgroundGradient).toContain('linear-gradient');
  });
  it('keeps every requested category gradient distinct', () => {
    const gradients = [
      'fashion',
      'food',
      'electronics',
      'pharmacy',
      'unknown-type',
    ].map(
      (businessType) =>
        buildCuratedHero(
          businessType,
          buildCuratedCopy({
            businessName: 'North Star',
            businessType,
            country: 'Nigeria',
          }).hero
        ).backgroundGradient
    );
    expect(new Set(gradients)).toHaveLength(5);
  });
});
