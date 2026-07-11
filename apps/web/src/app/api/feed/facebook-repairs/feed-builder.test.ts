import { describe, expect, it } from 'vitest';
import type { RepairFeedItem } from '@/lib/storefront-repairs/repairs-feed-data';
import { generateRepairsFacebookFeed } from './feed-builder';

const merchant = {
  business_name: 'Ogabassey',
  payout_currency: 'NGN',
  logo_url: 'https://cdn.example.com/logo.png',
};

const baseItem: RepairFeedItem = {
  quoteId: 'quote-1',
  price: 25000,
  isFromPrice: true,
  description: null,
  serviceTypeName: 'Screen Replacement',
  deviceId: 'device-1',
  deviceSlug: 'apple-iphone-13',
  deviceBrand: 'Apple',
  deviceModel: 'iPhone 13',
  deviceImageUrl: 'https://cdn.example.com/iphone-13.jpg',
  productId: 'product-1',
  productImageUrl: 'https://cdn.example.com/product-1.jpg',
};

describe('generateRepairsFacebookFeed', () => {
  it('emits a valid empty catalog when there are no items', () => {
    const xml = generateRepairsFacebookFeed(
      [],
      merchant,
      'https://ogabassey.com'
    );

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).not.toContain('<item>');
  });

  it('emits one item per quote using the linked product image first', () => {
    const xml = generateRepairsFacebookFeed(
      [baseItem],
      merchant,
      'https://ogabassey.com'
    );

    expect(xml).toContain('<g:id>quote-1</g:id>');
    expect(xml).toContain(
      '<g:title>Apple iPhone 13 Screen Replacement</g:title>'
    );
    expect(xml).toContain('<g:availability>in stock</g:availability>');
    expect(xml).toContain('<g:price>25000.00 NGN</g:price>');
    expect(xml).toContain(
      '<g:image_link>https://cdn.example.com/product-1.jpg</g:image_link>'
    );
    expect(xml).toContain(
      '<g:link>https://ogabassey.com/repairs/apple-iphone-13?utm_source=facebook&amp;utm_medium=feed&amp;utm_campaign=repairs_catalog</g:link>'
    );
    expect(xml).toContain('<g:brand>Ogabassey</g:brand>');
  });

  it('falls back to the device image when no product is linked', () => {
    const item: RepairFeedItem = {
      ...baseItem,
      productId: null,
      productImageUrl: null,
    };

    const xml = generateRepairsFacebookFeed(
      [item],
      merchant,
      'https://ogabassey.com'
    );

    expect(xml).toContain(
      '<g:image_link>https://cdn.example.com/iphone-13.jpg</g:image_link>'
    );
  });

  it('falls back to the merchant logo when neither product nor device image exist', () => {
    const item: RepairFeedItem = {
      ...baseItem,
      productId: null,
      productImageUrl: null,
      deviceImageUrl: null,
    };

    const xml = generateRepairsFacebookFeed(
      [item],
      merchant,
      'https://ogabassey.com'
    );

    expect(xml).toContain(
      '<g:image_link>https://cdn.example.com/logo.png</g:image_link>'
    );
  });

  it('skips an item entirely when no image can be resolved', () => {
    const item: RepairFeedItem = {
      ...baseItem,
      productId: null,
      productImageUrl: null,
      deviceImageUrl: null,
    };

    const xml = generateRepairsFacebookFeed(
      [item],
      { ...merchant, logo_url: null },
      'https://ogabassey.com'
    );

    expect(xml).not.toContain('<item>');
    expect(xml).not.toContain('<g:id>quote-1</g:id>');
  });

  it('uses the quote description when provided instead of the generated fallback', () => {
    const item: RepairFeedItem = {
      ...baseItem,
      description: 'Genuine OEM screen with 90-day warranty.',
    };

    const xml = generateRepairsFacebookFeed(
      [item],
      merchant,
      'https://ogabassey.com'
    );

    expect(xml).toContain(
      '<g:description>Genuine OEM screen with 90-day warranty.</g:description>'
    );
  });
});
