import { describe, expect, it } from 'vitest';
import { removeDuplicateLegacyFeaturedImage } from './blog-legacy-featured-image-dedupe';

const FEATURED = 'https://cdn.ogabassey.com/blog/featured.png';

describe('removeDuplicateLegacyFeaturedImage', () => {
  it('removes a leading legacy image when it duplicates the featured image', () => {
    const html = `<p><img src="${FEATURED}" alt="Hero" /></p><p>Body</p>`;

    expect(removeDuplicateLegacyFeaturedImage(html, FEATURED)).toBe(
      '<p>Body</p>'
    );
  });

  it('removes a leading picture wrapper when its fallback image duplicates the featured image', () => {
    const html = `<p><picture><source srcset="${FEATURED}.webp" type="image/webp"><img src="${FEATURED}" alt="Hero" /></picture></p><p>Body</p>`;

    expect(removeDuplicateLegacyFeaturedImage(html, FEATURED)).toBe(
      '<p>Body</p>'
    );
  });

  it('keeps the first body image when it is not the featured image', () => {
    const html = '<p><img src="https://cdn.example.com/body.png" /></p>';

    expect(removeDuplicateLegacyFeaturedImage(html, FEATURED)).toBe(html);
  });
});
