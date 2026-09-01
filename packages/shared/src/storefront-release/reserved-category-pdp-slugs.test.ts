import { describe, expect, it } from 'vitest';
import { STOREFRONT_RELEASE_RESERVED_CATEGORY_PDP_SLUGS } from './reserved-category-pdp-slugs';

describe('STOREFRONT_RELEASE_RESERVED_CATEGORY_PDP_SLUGS', () => {
  it('reserves category-level static PDP collisions', () => {
    expect(STOREFRONT_RELEASE_RESERVED_CATEGORY_PDP_SLUGS.has('compare')).toBe(
      true
    );
  });
});
