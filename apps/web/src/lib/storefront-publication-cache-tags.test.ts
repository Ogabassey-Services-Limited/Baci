import { describe, expect, it } from 'vitest';
import { buildStorefrontPublicationCacheTags } from './storefront-publication-cache-tags';

describe('buildStorefrontPublicationCacheTags', () => {
  it('covers platform aliases and every configured custom hostname', () => {
    expect(
      buildStorefrontPublicationCacheTags({
        customDomains: ['ogabassey.com', 'shop.example.com'],
        merchantSlugs: ['ogabassey', 'retired-store'],
      })
    ).toEqual([
      'ps:ogabassey',
      'ps:retired-store',
      'ph:ogabassey.com',
      'ph:www.ogabassey.com',
      'ph:shop.example.com',
      'ph:www.shop.example.com',
    ]);
  });

  it('covers a generic Vercel-only storefront by slug', () => {
    expect(
      buildStorefrontPublicationCacheTags({
        customDomains: [],
        merchantSlugs: ['merchant-demo'],
      })
    ).toEqual(['ps:merchant-demo']);
  });

  it('keeps legacy null-slug custom domains evictable', () => {
    expect(
      buildStorefrontPublicationCacheTags({
        customDomains: ['shop.example.com'],
        merchantSlugs: [],
      })
    ).toEqual(['ph:shop.example.com', 'ph:www.shop.example.com']);
  });
});
