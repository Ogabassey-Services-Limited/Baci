import { describe, expect, it } from 'vitest';
import { isStaleLegacyOgabasseyBlogImageUrl } from './blog-inline-image-stale-ogabassey-cdn';

describe('isStaleLegacyOgabasseyBlogImageUrl', () => {
  it('matches known stale legacy OgaBassey blog image paths', () => {
    expect(
      isStaleLegacyOgabasseyBlogImageUrl(
        new URL('https://cdn.ogabassey.com/blog/2023/03/iphone-xr.jpg')
      )
    ).toBe(true);
  });

  it('rejects lookalike origins and non-stale paths', () => {
    expect(
      isStaleLegacyOgabasseyBlogImageUrl(
        new URL(
          'https://cdn.ogabassey.com.evil.test/blog/2023/03/iphone-xr.jpg'
        )
      )
    ).toBe(false);
    expect(
      isStaleLegacyOgabasseyBlogImageUrl(
        new URL('https://cdn.ogabassey.com/blog/2026/07/fresh-image.jpg')
      )
    ).toBe(false);
  });
});
