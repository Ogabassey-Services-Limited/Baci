import { describe, expect, it } from 'vitest';
import {
  getStorefrontOpenGraphImages,
  getStorefrontSocialImageUrl,
  getStorefrontTwitterImages,
} from '@/lib/storefront-social-images';

describe('storefront social image helpers', () => {
  it('returns the first absolute candidate image URL', () => {
    expect(
      getStorefrontSocialImageUrl(
        'https://ogabassey.com',
        'https://cdn.example.com/cover.png',
        'https://cdn.example.com/backup.png'
      )
    ).toBe('https://cdn.example.com/cover.png');
  });

  it('resolves relative image URLs against the storefront base URL', () => {
    expect(
      getStorefrontSocialImageUrl(
        'https://ogabassey.com',
        '/images/social/storefront.png'
      )
    ).toBe('https://ogabassey.com/images/social/storefront.png');
  });

  it('falls back to the storefront opengraph-image route', () => {
    expect(getStorefrontSocialImageUrl('https://ogabassey.com')).toBe(
      'https://ogabassey.com/opengraph-image'
    );
  });

  it('returns Open Graph image objects with alt text', () => {
    expect(
      getStorefrontOpenGraphImages(
        'https://ogabassey.com',
        'Ogabassey products',
        'https://cdn.example.com/cover.png'
      )
    ).toEqual([
      {
        url: 'https://cdn.example.com/cover.png',
        alt: 'Ogabassey products',
      },
    ]);
  });

  it('returns Twitter image arrays using the same fallback logic', () => {
    expect(getStorefrontTwitterImages('https://ogabassey.com')).toEqual([
      'https://ogabassey.com/opengraph-image',
    ]);
  });

  it('returns null when every candidate is invalid and the base URL cannot build the fallback image', () => {
    expect(
      getStorefrontSocialImageUrl('not-a-valid-url', 'still-not-a-valid-url')
    ).toBeNull();
    expect(getStorefrontOpenGraphImages('not-a-valid-url', 'Alt text')).toEqual(
      []
    );
    expect(getStorefrontTwitterImages('not-a-valid-url')).toEqual([]);
  });

  it('prefers the first absolute candidate even when relative candidates follow', () => {
    expect(
      getStorefrontSocialImageUrl(
        'https://ogabassey.com',
        'https://cdn.example.com/cover.png',
        '/images/social/storefront.png'
      )
    ).toBe('https://cdn.example.com/cover.png');
  });

  it('handles storefront base URLs with trailing slashes', () => {
    expect(
      getStorefrontSocialImageUrl(
        'https://ogabassey.com/',
        '/images/social/storefront.png'
      )
    ).toBe('https://ogabassey.com/images/social/storefront.png');
  });

  it('preserves URL-encoded image paths and query parameters', () => {
    expect(
      getStorefrontSocialImageUrl(
        'https://ogabassey.com',
        '/images/sale%20banner.png?width=1200&fit=cover'
      )
    ).toBe(
      'https://ogabassey.com/images/sale%20banner.png?width=1200&fit=cover'
    );
  });

  it('ignores empty candidates before falling back', () => {
    expect(
      getStorefrontSocialImageUrl('https://ogabassey.com', '', undefined, null)
    ).toBe('https://ogabassey.com/opengraph-image');
  });

  it('returns Twitter image arrays for explicit candidate URLs', () => {
    expect(
      getStorefrontTwitterImages(
        'https://ogabassey.com',
        'https://cdn.example.com/twitter-cover.png'
      )
    ).toEqual(['https://cdn.example.com/twitter-cover.png']);
  });
});
