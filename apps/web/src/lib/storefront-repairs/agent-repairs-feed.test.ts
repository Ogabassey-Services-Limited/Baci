import { describe, expect, it } from 'vitest';
import { generateAgentRepairsFeed } from './agent-repairs-feed';
import type { RepairFeedItem } from './repairs-feed-data';

const merchant = {
  business_name: 'Ogabassey',
  payout_currency: 'NGN',
  logo_url: 'https://cdn.example.com/logo.png',
};

const baseItem: RepairFeedItem = {
  quoteId: 'quote-1',
  price: 25000,
  isFromPrice: true,
  description: 'OEM screen replacement',
  serviceTypeName: 'Screen Replacement',
  deviceId: 'device-1',
  deviceSlug: 'apple-iphone-13',
  deviceBrand: 'Apple',
  deviceModel: 'iPhone 13',
  deviceImageUrl: 'https://cdn.example.com/iphone-13.jpg',
  productId: 'product-1',
  productImageUrl: 'https://cdn.example.com/product-1.jpg',
};

describe('generateAgentRepairsFeed', () => {
  it('returns an empty array for an empty catalog', () => {
    expect(
      generateAgentRepairsFeed([], merchant, 'https://ogabassey.com')
    ).toEqual([]);
  });

  it('maps one JSONL line per quote with a repair_service type', () => {
    const [line] = generateAgentRepairsFeed(
      [baseItem],
      merchant,
      'https://ogabassey.com'
    );
    const entry = JSON.parse(line);

    expect(entry).toEqual({
      id: 'quote-1',
      type: 'repair_service',
      title: 'Apple iPhone 13 Screen Replacement',
      service_type: 'Screen Replacement',
      device: 'Apple iPhone 13',
      device_brand: 'Apple',
      device_model: 'iPhone 13',
      price: 25000,
      price_currency: 'NGN',
      is_from_price: true,
      availability: 'in_stock',
      link: 'https://ogabassey.com/repairs/apple-iphone-13?utm_source=agent&utm_medium=feed&utm_campaign=repairs_catalog',
      image_link: 'https://cdn.example.com/product-1.jpg',
      description: 'OEM screen replacement',
      merchant_name: 'Ogabassey',
      related_product_id: 'product-1',
    });
  });

  it('omits related_product_id and falls back to the device image when unlinked', () => {
    const [line] = generateAgentRepairsFeed(
      [{ ...baseItem, productId: null, productImageUrl: null }],
      merchant,
      'https://ogabassey.com'
    );
    const entry = JSON.parse(line);

    expect(entry.related_product_id).toBeUndefined();
    expect(entry.image_link).toBe('https://cdn.example.com/iphone-13.jpg');
  });

  it('omits optional fields when no image or description is available', () => {
    const [line] = generateAgentRepairsFeed(
      [
        {
          ...baseItem,
          description: null,
          productId: null,
          productImageUrl: null,
          deviceImageUrl: null,
        },
      ],
      { ...merchant, logo_url: null },
      'https://ogabassey.com'
    );
    const entry = JSON.parse(line);

    expect(entry.image_link).toBeUndefined();
    expect(entry.description).toBeUndefined();
  });
});
