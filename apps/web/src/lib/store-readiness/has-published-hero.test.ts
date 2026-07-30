import { describe, expect, it } from 'vitest';
import { hasPublishedHero } from './has-published-hero';

describe('hasPublishedHero', () => {
  it('recognizes a Hero in top-level builder content', () => {
    expect(hasPublishedHero({ content: [{ type: 'Hero', props: {} }] })).toBe(
      true
    );
  });

  it('recognizes a HeroCarousel in top-level builder content', () => {
    expect(
      hasPublishedHero({ content: [{ type: 'HeroCarousel', props: {} }] })
    ).toBe(true);
  });

  it('recognizes the OgabasseyHero registered by the Ogabassey template', () => {
    expect(
      hasPublishedHero({ content: [{ type: 'OgabasseyHero', props: {} }] })
    ).toBe(true);
  });

  it('does not treat a non-hero component as a published hero', () => {
    expect(
      hasPublishedHero({ content: [{ type: 'Products', props: {} }] })
    ).toBe(false);
  });

  it('recognizes a Hero in a builder zone', () => {
    expect(
      hasPublishedHero({
        content: [],
        zones: { 'Container-1:children': [{ type: 'Hero', props: {} }] },
      })
    ).toBe(true);
  });

  it.each([
    null,
    { content: 'invalid' },
  ])('returns false for malformed builder config %j', (config) => {
    expect(hasPublishedHero(config)).toBe(false);
  });
});
