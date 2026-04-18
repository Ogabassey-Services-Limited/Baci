import { describe, expect, it } from 'vitest';
import { FEED_PRODUCTS_SELECT } from './feed-query';

describe('FEED_PRODUCTS_SELECT', () => {
  it('includes category_slug and product_categories(categories(name, slug))', () => {
    expect(FEED_PRODUCTS_SELECT).toContain('category_slug');
    expect(FEED_PRODUCTS_SELECT).toContain(
      'product_categories(categories(name, slug))'
    );
  });
});
