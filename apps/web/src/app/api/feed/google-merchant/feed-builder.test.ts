import { describe, expect, it } from 'vitest';
import type { FeedImageManifestEntry } from '@/lib/gmc-feed-images';
import {
  type FeedMerchant,
  type FeedProduct,
  generateGoogleMerchantFeed,
} from './feed-builder';

// ---------- helpers ----------
function product(overrides: Partial<FeedProduct> = {}): FeedProduct {
  return {
    id: 'prod-1',
    name: 'Test Product',
    description: 'A test product',
    slug: 'test-product',
    price: 100,
    stock: 10,
    ...overrides,
  };
}

function merchant(overrides: Partial<FeedMerchant> = {}): FeedMerchant {
  return {
    id: 'merchant-1',
    business_name: 'Test Store',
    slug: 'test-store',
    payout_currency: 'NGN',
    ...overrides,
  };
}

function manifestEntry(
  overrides: Partial<FeedImageManifestEntry> = {}
): FeedImageManifestEntry {
  return {
    verified_url: 'https://cdn.example.com/products/test.jpg',
    verified_format: 'jpeg',
    status: 'verified',
    is_primary: true,
    position: 0,
    ...overrides,
  };
}

const BASE_URL = 'https://ogabassey.com';

// ---------- image_link guarantees ----------
describe('generateGoogleMerchantFeed — image_link guarantees', () => {
  it('emits verified primary image URL in g:image_link', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [
        manifestEntry({
          verified_url: 'https://cdn.example.com/products/phone.jpg',
        }),
      ],
    };
    const xml = generateGoogleMerchantFeed(
      [product()],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).toContain(
      '<g:image_link>https://cdn.example.com/products/phone.jpg</g:image_link>'
    );
  });

  it('never emits blank g:image_link', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {};
    const xml = generateGoogleMerchantFeed(
      [product()],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).not.toContain('<g:image_link></g:image_link>');
    expect(xml).not.toContain('<g:image_link/>');
  });

  it('excludes entire product item when no verified primary image exists', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [
        manifestEntry({
          status: 'missing',
          verified_url: null,
          is_primary: true,
        }),
      ],
    };
    const xml = generateGoogleMerchantFeed(
      [product()],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).not.toContain('<g:id>prod-1</g:id>');
    expect(xml).not.toContain('<item>');
  });

  it('excludes product when manifest has no entries for it', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {};
    const xml = generateGoogleMerchantFeed(
      [product({ id: 'no-image-product' })],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).not.toContain('<g:id>no-image-product</g:id>');
  });

  it('never emits raw AVIF URLs in output', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [
        manifestEntry({
          verified_url: 'https://cdn.example.com/products/phone.jpg',
          verified_format: 'jpeg',
        }),
      ],
    };
    const xml = generateGoogleMerchantFeed(
      [product()],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).not.toMatch(/\.avif/i);
  });

  it('preserves verified WebP URLs (no forced conversion)', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [
        manifestEntry({
          verified_url: 'https://cdn.example.com/products/phone.webp',
          verified_format: 'webp',
          is_primary: true,
        }),
      ],
    };
    const xml = generateGoogleMerchantFeed(
      [product()],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).toContain(
      '<g:image_link>https://cdn.example.com/products/phone.webp</g:image_link>'
    );
  });
});

// ---------- additional_image_link guarantees ----------
describe('generateGoogleMerchantFeed — additional_image_link guarantees', () => {
  it('emits verified additional images', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [
        manifestEntry({
          is_primary: true,
          position: 0,
          verified_url: 'https://cdn.example.com/main.jpg',
        }),
        manifestEntry({
          is_primary: false,
          position: 0,
          verified_url: 'https://cdn.example.com/extra1.jpg',
        }),
        manifestEntry({
          is_primary: false,
          position: 1,
          verified_url: 'https://cdn.example.com/extra2.png',
        }),
      ],
    };
    const xml = generateGoogleMerchantFeed(
      [product()],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).toContain(
      '<g:additional_image_link>https://cdn.example.com/extra1.jpg</g:additional_image_link>'
    );
    expect(xml).toContain(
      '<g:additional_image_link>https://cdn.example.com/extra2.png</g:additional_image_link>'
    );
  });

  it('omits unverified additional images instead of emitting broken URLs', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [
        manifestEntry({
          is_primary: true,
          position: 0,
          verified_url: 'https://cdn.example.com/main.jpg',
        }),
        manifestEntry({
          is_primary: false,
          position: 0,
          status: 'missing',
          verified_url: null,
        }),
        manifestEntry({
          is_primary: false,
          position: 1,
          verified_url: 'https://cdn.example.com/good.jpg',
        }),
      ],
    };
    const xml = generateGoogleMerchantFeed(
      [product()],
      merchant(),
      BASE_URL,
      imageManifest
    );
    // Only the good additional image should appear
    const additionalCount = (xml.match(/<g:additional_image_link>/g) || [])
      .length;
    expect(additionalCount).toBe(1);
    expect(xml).toContain(
      '<g:additional_image_link>https://cdn.example.com/good.jpg</g:additional_image_link>'
    );
  });

  it('emits no additional_image_link when all additional entries are unverified', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [
        manifestEntry({ is_primary: true, position: 0 }),
        manifestEntry({
          is_primary: false,
          position: 0,
          status: 'missing',
          verified_url: null,
        }),
      ],
    };
    const xml = generateGoogleMerchantFeed(
      [product()],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).not.toContain('<g:additional_image_link>');
  });
});

// ---------- feed structure ----------
describe('generateGoogleMerchantFeed — feed structure', () => {
  it('includes multiple products with verified images', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [
        manifestEntry({
          is_primary: true,
          verified_url: 'https://cdn.example.com/p1.jpg',
        }),
      ],
      'prod-2': [
        manifestEntry({
          is_primary: true,
          verified_url: 'https://cdn.example.com/p2.png',
        }),
      ],
    };
    const xml = generateGoogleMerchantFeed(
      [
        product({ id: 'prod-1', name: 'Product 1' }),
        product({ id: 'prod-2', name: 'Product 2' }),
      ],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).toContain('<g:id>prod-1</g:id>');
    expect(xml).toContain('<g:id>prod-2</g:id>');
  });

  it('excludes products without valid price', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [manifestEntry({ is_primary: true })],
    };
    const xml = generateGoogleMerchantFeed(
      [product({ price: 0 })],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).not.toContain('<item>');
  });

  it('excludes products without name', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [manifestEntry({ is_primary: true })],
    };
    const xml = generateGoogleMerchantFeed(
      [product({ name: '' })],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).not.toContain('<item>');
  });

  it('generates valid XML envelope', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {};
    const xml = generateGoogleMerchantFeed(
      [],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
  });

  it('performs zero network calls (no fetch/HEAD in feed generation)', async () => {
    const { vi } = await import('vitest');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('fetch should not be called'));

    try {
      const imageManifest: Record<string, FeedImageManifestEntry[]> = {
        'prod-1': [manifestEntry({ is_primary: true })],
      };
      generateGoogleMerchantFeed(
        [product()],
        merchant(),
        BASE_URL,
        imageManifest
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('escapes XML special characters in product fields', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [manifestEntry({ is_primary: true })],
    };
    const xml = generateGoogleMerchantFeed(
      [
        product({
          name: 'Phone <Pro> & "Max"',
          description: "It's the best <phone> ever & more",
        }),
      ],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).toContain('&lt;Pro&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;Max&quot;');
    expect(xml).not.toContain('<Pro>');
  });

  it('sets identifier_exists to yes when GTIN is present', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [manifestEntry({ is_primary: true })],
    };
    const xml = generateGoogleMerchantFeed(
      [product({ gtin: '0123456789012' })],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).toContain('<g:identifier_exists>yes</g:identifier_exists>');
  });

  it('sets identifier_exists to no when GTIN, MPN, and brand are all missing', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [manifestEntry({ is_primary: true })],
    };
    const xml = generateGoogleMerchantFeed(
      [product({ gtin: undefined, mpn: undefined, brand: undefined })],
      merchant({ business_name: '' }),
      BASE_URL,
      imageManifest
    );
    expect(xml).toContain('<g:identifier_exists>no</g:identifier_exists>');
  });
});
