import { describe, expect, it } from 'vitest';
import { getBlogPostSocialImage } from '@/lib/blog-post-social-image';

const STORE_URL = 'https://ogabassey.com';
const POST_SLUG = 'apple-studio-display-review';

describe('blog post social image projection', () => {
  it('publishes managed landscape variants as fixed JPEG CDN transforms', () => {
    const image = getBlogPostSocialImage(
      STORE_URL,
      POST_SLUG,
      'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/apple-landscape_16x9.jpg',
      {
        landscape_16x9:
          'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/apple-landscape_16x9.jpg',
      }
    );

    expect(image).toEqual({
      url: 'https://cdn.ogabassey.com/image/width=1200,quality=75,format=jpeg/core-assets/blog/apple-landscape_16x9.jpg',
      width: 1200,
      height: 675,
      type: 'image/jpeg',
    });
    expect(image.url).not.toContain('format=auto');
  });

  it('uses a valid external featured image directly', () => {
    expect(
      getBlogPostSocialImage(
        STORE_URL,
        POST_SLUG,
        'https://images.example.com/article.png',
        {}
      )
    ).toEqual({
      url: 'https://images.example.com/article.png',
      type: 'image/png',
    });
  });

  it('preserves the store-aware compatibility route when candidates are unusable', () => {
    expect(
      getBlogPostSocialImage(
        'https://stores.example.com/merchant',
        POST_SLUG,
        'javascript:alert(1)',
        { landscape_16x9: 'not a URL' }
      )
    ).toEqual({
      url: 'https://stores.example.com/merchant/blog/apple-studio-display-review/opengraph-image',
      width: 1200,
      height: 630,
      type: 'image/png',
    });
  });

  it('rejects non-HTTP schemes even when they look like image URLs', () => {
    const image = getBlogPostSocialImage(
      STORE_URL,
      POST_SLUG,
      'data:image/png;base64,abc',
      { landscape_16x9: 'ftp://cdn.example.com/cover.jpg' }
    );

    expect(image.url).toBe(
      'https://ogabassey.com/blog/apple-studio-display-review/opengraph-image'
    );
  });

  it('uses positive recorded dimensions for a direct original image', () => {
    expect(
      getBlogPostSocialImage(
        STORE_URL,
        POST_SLUG,
        'https://images.example.com/article.webp',
        {},
        1600,
        900
      )
    ).toEqual({
      url: 'https://images.example.com/article.webp',
      width: 1600,
      height: 900,
      type: 'image/webp',
    });
  });

  it('uses a PNG fallback transform for managed PNG sources', () => {
    expect(
      getBlogPostSocialImage(
        STORE_URL,
        POST_SLUG,
        'https://cdn.ogabassey.com/core-assets/blog/card.png',
        {}
      )
    ).toEqual({
      url: 'https://cdn.ogabassey.com/image/width=1200,quality=75,format=png/core-assets/blog/card.png',
      type: 'image/png',
    });
  });

  it('reports JPEG MIME for managed WebP and AVIF fallback transforms', () => {
    for (const extension of ['webp', 'avif']) {
      expect(
        getBlogPostSocialImage(
          STORE_URL,
          POST_SLUG,
          `https://cdn.ogabassey.com/core-assets/blog/card.${extension}`,
          {}
        )
      ).toEqual({
        url: `https://cdn.ogabassey.com/image/width=1200,quality=75,format=jpeg/core-assets/blog/card.${extension}`,
        type: 'image/jpeg',
      });
    }
  });

  it('keeps PNG MIME for managed PNG URLs with query strings and hashes', () => {
    expect(
      getBlogPostSocialImage(
        STORE_URL,
        POST_SLUG,
        'https://cdn.ogabassey.com/core-assets/blog/card.png?version=1#hero',
        {}
      )
    ).toEqual({
      url: 'https://cdn.ogabassey.com/image/width=1200,quality=75,format=png/core-assets/blog/card.png?version=1#hero',
      type: 'image/png',
    });
  });

  it('matches transformed managed-original dimensions to its 1200px output', () => {
    expect(
      getBlogPostSocialImage(
        STORE_URL,
        POST_SLUG,
        'https://cdn.ogabassey.com/core-assets/blog/card.jpg',
        {},
        1600,
        900
      )
    ).toEqual({
      url: 'https://cdn.ogabassey.com/image/width=1200,quality=75,format=jpeg/core-assets/blog/card.jpg',
      width: 1200,
      height: 675,
      type: 'image/jpeg',
    });
  });
});
