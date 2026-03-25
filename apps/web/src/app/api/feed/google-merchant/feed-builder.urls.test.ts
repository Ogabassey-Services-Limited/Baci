import { describe, expect, it } from 'vitest';
import type { FeedImageManifestEntry } from '@/lib/gmc-feed-images';
import { generateGoogleMerchantFeed } from './feed-builder';

const BASE_URL = 'https://ogabassey.com/';

function manifestEntry(): FeedImageManifestEntry {
  return {
    verified_url: 'https://cdn.example.com/products/test.jpg',
    verified_format: 'jpeg',
    status: 'verified',
    is_primary: true,
    position: 0,
  };
}

describe('generateGoogleMerchantFeed canonical URLs', () => {
  it('uses category-based storefront URLs when category text is present', () => {
    const xml = generateGoogleMerchantFeed(
      [
        {
          id: 'prod-1',
          name: 'iPhone XR',
          description: 'Refurbished iPhone XR',
          slug: 'iphone-xr',
          category: 'Smartphones',
          price: 100,
          stock: 10,
        },
      ],
      {
        id: 'merchant-1',
        business_name: 'Ogabassey',
        slug: 'ogabassey',
        payout_currency: 'NGN',
      },
      BASE_URL,
      {
        'prod-1': [manifestEntry()],
      }
    );

    expect(xml).toContain(
      '<g:link>https://ogabassey.com/smartphones/iphone-xr</g:link>'
    );
    expect(xml).not.toContain(
      '<g:link>https://ogabassey.com/products/iphone-xr</g:link>'
    );
  });
});
