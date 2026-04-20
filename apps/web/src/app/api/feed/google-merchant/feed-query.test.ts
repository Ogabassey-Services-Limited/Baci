import { describe, expect, it } from 'vitest';
import { FEED_PRODUCTS_SELECT } from './feed-query';

describe('FEED_PRODUCTS_SELECT', () => {
  it('includes category and spec fields required for enriched feed descriptions', () => {
    expect(FEED_PRODUCTS_SELECT).toContain('category_slug');
    expect(FEED_PRODUCTS_SELECT).toContain('color');
    expect(FEED_PRODUCTS_SELECT).toContain('product_key_specs');
    expect(FEED_PRODUCTS_SELECT).toContain(
      'product_categories(categories(name, slug))'
    );
  });
});
