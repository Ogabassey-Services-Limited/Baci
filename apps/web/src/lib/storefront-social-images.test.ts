import { describe, expect, it } from 'vitest';
import {
  getStorefrontOpenGraphImages,
  getStorefrontSocialImageUrl,
  getStorefrontTwitterImages,
} from './storefront-social-images';

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
});
