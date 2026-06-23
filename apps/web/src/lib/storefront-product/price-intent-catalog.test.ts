import { describe, expect, it } from 'vitest';
import {
  getPriceIntentModifiers,
  getPriceIntentStopTokens,
  getRequestedCategorySlug,
  preparePriceIntentCatalog,
  tokenizePriceIntentText,
} from './price-intent-catalog';

describe('price intent catalog helpers', () => {
  it('normalizes tokens and compact storage modifiers', () => {
    expect(tokenizePriceIntentText('iPhone 13 Pro 128 GB')).toEqual([
      'iphone',
      '13',
      'pro',
      '128gb',
    ]);
  });

  it('extracts storage and condition modifiers from a keyword', () => {
    expect(getPriceIntentModifiers('iphone x 64 GB uk used price')).toEqual([
      '64gb',
      'uk-used',
    ]);
  });

  it('maps category wording to catalog category slugs', () => {
    expect(getRequestedCategorySlug(new Set(['phone', 'price']))).toBe(
      'smartphones'
    );
  });

  it('prepares catalog tokens without market or modifier tokens', () => {
    const [entry] = preparePriceIntentCatalog(
      [
        {
          slug: 'iphone-x-64gb-uk-used',
          name: 'iPhone X 64GB UK Used',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'UK Used',
        },
      ],
      'Nigeria'
    );

    expect(entry?.brandTokens).toEqual(['apple']);
    expect(entry?.coreTokens).toEqual(['iphone', 'x']);
    expect(entry?.tokenSet.has('64gb')).toBe(false);
  });

  it('includes market phrase tokens in the stop token set', () => {
    expect(getPriceIntentStopTokens('Nigeria').has('nigeria')).toBe(true);
  });
});
