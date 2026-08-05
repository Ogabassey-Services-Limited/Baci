import { describe, expect, it } from 'vitest';
import { isStorefrontSitemapPublished } from './is-storefront-sitemap-published';

describe('isStorefrontSitemapPublished', () => {
  it('accepts only explicitly published storefronts', () => {
    expect(isStorefrontSitemapPublished({ is_published: true })).toBe(true);
    expect(isStorefrontSitemapPublished({ is_published: false })).toBe(false);
    expect(isStorefrontSitemapPublished({ is_published: null })).toBe(false);
  });
});
