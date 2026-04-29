import { describe, expect, it } from 'vitest';
import { FEED_PRODUCTS_SELECT } from './feed-query';

describe('FEED_PRODUCTS_SELECT', () => {
  it('does not select the legacy products.category_slug column', () => {
    expect(FEED_PRODUCTS_SELECT).not.toMatch(/(^|[\s,])category_slug([\s,]|$)/);
  });

  it('includes category joins and spec fields required for enriched feed descriptions', () => {
    expect(FEED_PRODUCTS_SELECT).toMatch(/(^|[\s,])category([\s,]|$)/);
    expect(FEED_PRODUCTS_SELECT).toContain('color');
    expect(FEED_PRODUCTS_SELECT).toContain(
      'product_categories(categories(name, slug))'
    );
  });

  it('enumerates product_key_specs fields without wildcard selects', () => {
    expect(FEED_PRODUCTS_SELECT).not.toContain('product_key_specs(*)');
    expect(FEED_PRODUCTS_SELECT).toContain(
      'product_key_specs(screen_size_inches, ram_gb, storage_gb, main_camera_mp, weight_g, available_colors, display_resolution, front_camera_mp)'
    );
  });
});
