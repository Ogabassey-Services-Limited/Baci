import { describe, expect, it } from 'vitest';
import { getStorefrontProductSocialMetadata } from '@/lib/storefront-product-social-metadata';

describe('getStorefrontProductSocialMetadata', () => {
  it('builds product price, availability, and image metadata', () => {
    const metadata = getStorefrontProductSocialMetadata(
      'https://ogabassey.com',
      {
        name: 'iPhone 17 Pro Max',
        image: 'https://cdn.ogabassey.com/iphone-17-pro-max.png',
        base_price: 1899000,
        track_quantity: false,
        condition: 'new',
      },
      'NGN'
    );

    expect(metadata.openGraphImages).toEqual([
      {
        url: 'https://cdn.ogabassey.com/iphone-17-pro-max.png',
        alt: 'iPhone 17 Pro Max',
      },
    ]);
    expect(metadata.twitterImages).toEqual([
      'https://cdn.ogabassey.com/iphone-17-pro-max.png',
    ]);
    expect(metadata.other).toMatchObject({
      'product:price:amount': '1899000',
      'product:price:currency': 'NGN',
      'product:availability': 'in stock',
      'product:condition': 'new',
      'twitter:data1': 'NGN 1899000',
      'twitter:data2': 'In stock',
    });
  });

  it('marks managed zero-stock products as out of stock and falls back to default image', () => {
    const metadata = getStorefrontProductSocialMetadata(
      'https://ogabassey.com',
      {
        name: 'HP Laptop',
        images: [],
        price: 645600,
        manage_stock: true,
        stock_quantity: 0,
        condition: 'open_box',
      },
      'NGN'
    );

    expect(metadata.openGraphImages).toEqual([
      {
        url: 'https://ogabassey.com/opengraph-image',
        alt: 'HP Laptop',
      },
    ]);
    expect(metadata.twitterImages).toEqual([
      'https://ogabassey.com/opengraph-image',
    ]);
    expect(metadata.other).toMatchObject({
      'product:availability': 'out of stock',
      'product:condition': 'used',
      'twitter:data2': 'Out of stock',
    });
    expect(metadata.other).not.toHaveProperty('product:price:amount');
    expect(metadata.other).not.toHaveProperty('product:price:currency');
  });

  it('uses the lowest variant price for product-family social metadata', () => {
    const metadata = getStorefrontProductSocialMetadata(
      'https://ogabassey.com',
      {
        name: 'iPhone XR',
        price: 230000,
        variants: [
          { price_override: 180000 },
          { price_override: 220000 },
          { price_override: 300000 },
        ],
      },
      'NGN'
    );

    expect(metadata.other).toMatchObject({
      'product:price:amount': '180000',
      'product:price:currency': 'NGN',
      'twitter:data1': 'NGN 180000',
    });
  });

  it('keeps zero-price products in social price metadata', () => {
    const metadata = getStorefrontProductSocialMetadata(
      'https://ogabassey.com',
      {
        name: 'Launch Giveaway',
        price: 0,
      },
      'NGN'
    );

    expect(metadata.other).toMatchObject({
      'product:price:amount': '0',
      'product:price:currency': 'NGN',
      'twitter:data1': 'NGN 0',
    });
  });
});
