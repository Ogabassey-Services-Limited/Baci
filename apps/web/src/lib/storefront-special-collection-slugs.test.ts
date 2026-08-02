import { describe, expect, it } from 'vitest';
import { STOREFRONT_SPECIAL_COLLECTION_SLUGS } from './storefront-special-collection-slugs';

describe('STOREFRONT_SPECIAL_COLLECTION_SLUGS', () => {
  it('keeps every virtual collection slug reserved from merchant categories', () => {
    expect(STOREFRONT_SPECIAL_COLLECTION_SLUGS).toEqual([
      'new-arrivals',
      'best-sellers',
      'on-sale',
      'featured',
    ]);
  });
});
