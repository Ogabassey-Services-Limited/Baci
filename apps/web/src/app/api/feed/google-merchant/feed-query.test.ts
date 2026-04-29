import { describe, expect, it } from 'vitest';
import { FEED_PRODUCTS_SELECT } from './feed-query';

describe('FEED_PRODUCTS_SELECT', () => {
  it('includes category and spec fields required for enriched feed descriptions', () => {
    expect(FEED_PRODUCTS_SELECT).toMatch(/(^|[\s,])category([\s,]|$)/);
    expect(FEED_PRODUCTS_SELECT).toContain('color');
    expect(FEED_PRODUCTS_SELECT).toContain('product_key_specs(*)');
    expect(FEED_PRODUCTS_SELECT).toContain(
      'product_categories(categories(name, slug))'
    );
  });

  it('does not select the removed products.category_slug column directly', () => {
    expect(FEED_PRODUCTS_SELECT).not.toMatch(/(^|[\s,])category_slug([\s,]|$)/);
  });
});
