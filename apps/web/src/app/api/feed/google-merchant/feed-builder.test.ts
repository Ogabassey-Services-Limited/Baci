import { describe, expect, it, vi } from 'vitest';
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

  it('does not produce double-slash in product URL when baseUrl has trailing slash', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [manifestEntry({ is_primary: true })],
    };
    const xml = generateGoogleMerchantFeed(
      [product()],
      merchant(),
      'https://ogabassey.com/',
      imageManifest
    );
    expect(xml).toContain(
      '<g:link>https://ogabassey.com/products/test-product</g:link>'
    );
    expect(xml).not.toContain('//products');
  });

  it('performs zero network calls (no fetch/HEAD in feed generation)', () => {
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

  it('sets identifier_exists to yes when MPN and brand are both present', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [manifestEntry({ is_primary: true })],
    };
    const xml = generateGoogleMerchantFeed(
      [product({ mpn: 'MPN-123', brand: 'Samsung' })],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).toContain('<g:identifier_exists>yes</g:identifier_exists>');
  });

  it('sets identifier_exists to no when only brand is present (no GTIN or MPN)', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [manifestEntry({ is_primary: true })],
    };
    const xml = generateGoogleMerchantFeed(
      [product({ gtin: undefined, mpn: undefined, brand: 'Samsung' })],
      merchant(),
      BASE_URL,
      imageManifest
    );
    expect(xml).toContain('<g:identifier_exists>no</g:identifier_exists>');
  });

  it('sets identifier_exists to yes when MPN is present and brand falls back to business_name', () => {
    const imageManifest: Record<string, FeedImageManifestEntry[]> = {
      'prod-1': [manifestEntry({ is_primary: true })],
    };
    const xml = generateGoogleMerchantFeed(
      [product({ gtin: undefined, mpn: 'MPN-456', brand: undefined })],
      merchant({ business_name: 'Ogabassey' }),
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

// ---------- variant emission ----------
describe('generateGoogleMerchantFeed — variant emission', () => {
  const defaultManifest: Record<string, FeedImageManifestEntry[]> = {
    'prod-1': [
      manifestEntry({
        is_primary: true,
        verified_url: 'https://cdn.example.com/phone.jpg',
      }),
    ],
  };

  it('emits one item per variant with shared item_group_id', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Blue', storage: '128GB' },
              stock_quantity: 5,
            },
            {
              id: 'var-2',
              attributes: { color: 'Black', storage: '256GB' },
              stock_quantity: 3,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:id>var-1</g:id>');
    expect(xml).toContain('<g:id>var-2</g:id>');
    expect(xml).not.toContain('<g:id>prod-1</g:id>');
    // Both share the same item_group_id
    const groupMatches = xml.match(
      /<g:item_group_id>prod-1<\/g:item_group_id>/g
    );
    expect(groupMatches).toHaveLength(2);
  });

  it('uses variant UUID as g:id, not SKU or attributes', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          variants: [
            {
              id: 'uuid-abc-123',
              sku: 'SKU-PHONE-BLUE',
              attributes: { color: 'Blue' },
              stock_quantity: 10,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:id>uuid-abc-123</g:id>');
    expect(xml).not.toContain('<g:id>SKU-PHONE-BLUE</g:id>');
  });

  it('uses variant price_override when present', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          price: 100,
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Blue' },
              price_override: 150,
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:price>150.00 NGN</g:price>');
  });

  it('falls back to product price when no price_override', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          price: 100,
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Blue' },
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:price>100.00 NGN</g:price>');
  });

  it.each([
    0,
    -25,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('falls back to product price when price_override is invalid: %s', (invalidOverride) => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          price: 100,
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Blue' },
              price_override: invalidOverride,
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );

    expect(xml).toContain('<g:price>100.00 NGN</g:price>');
  });

  it('sets availability from variant stock_quantity', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          variants: [
            {
              id: 'var-oos',
              attributes: { color: 'Red' },
              stock_quantity: 0,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:availability>out_of_stock</g:availability>');
  });

  it('clamps invalid variant stock_quantity to zero', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          variants: [
            {
              id: 'var-invalid-stock',
              attributes: { color: 'Red' },
              stock_quantity: -3,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:availability>out_of_stock</g:availability>');
    expect(xml).toContain('<g:quantity>0</g:quantity>');
  });

  it('emits g:color and g:size from variant attributes', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Titanium Blue', storage: '256GB' },
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:color>Titanium Blue</g:color>');
    expect(xml).toContain('<g:size>256GB</g:size>');
  });

  it('builds variant title with differentiators', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          name: 'iPhone 16',
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Blue', storage: '128GB' },
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:title>iPhone 16 - Blue - 128GB</g:title>');
  });

  it('emits product_detail from key_specs', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          key_specs: { ram_gb: 12, battery_mah: 5000 },
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Blue' },
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:attribute_name>RAM</g:attribute_name>');
    expect(xml).toContain('<g:attribute_value>12GB</g:attribute_value>');
    expect(xml).toContain('<g:attribute_name>Battery</g:attribute_name>');
  });

  it('emits no item_group_id for products without variants (backward compat)', () => {
    const xml = generateGoogleMerchantFeed(
      [product()],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).not.toContain('<g:item_group_id>');
    expect(xml).toContain('<g:id>prod-1</g:id>');
  });

  it('excludes variant items when product has no verified manifest image', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Blue' },
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      {} // empty manifest
    );
    expect(xml).not.toContain('<g:id>var-1</g:id>');
    expect(xml).not.toContain('<item>');
  });

  it('falls back to single item when no variant has mappable GMC axis', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          variants: [
            {
              id: 'var-1',
              attributes: { ram: '12GB', sim_type: 'eSIM' },
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    // Should emit product-level item, not variant item
    expect(xml).toContain('<g:id>prod-1</g:id>');
    expect(xml).not.toContain('<g:id>var-1</g:id>');
    expect(xml).not.toContain('<g:item_group_id>');
  });

  it('deduplicates variants by id', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          variants: [
            {
              id: 'var-dup',
              attributes: { color: 'Blue' },
              stock_quantity: 5,
            },
            {
              id: 'var-dup',
              attributes: { color: 'Blue' },
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    const idMatches = xml.match(/<g:id>var-dup<\/g:id>/g);
    expect(idMatches).toHaveLength(1);
  });

  it('emits variant link with ?variant= query param', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          slug: 'iphone-16',
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Blue' },
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('?variant=var-1</g:link>');
  });

  it('emits canonical_link without ?variant= for variant items', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          slug: 'iphone-16',
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Blue' },
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:canonical_link>');
    // canonical_link should NOT have ?variant=
    expect(xml).not.toMatch(/<g:canonical_link>[^<]*\?variant=/);
  });

  it('uses variant SKU as g:mpn when available', () => {
    const xml = generateGoogleMerchantFeed(
      [
        product({
          variants: [
            {
              id: 'var-1',
              sku: 'SKU-BLUE-128',
              attributes: { color: 'Blue' },
              stock_quantity: 5,
            },
          ],
        }),
      ],
      merchant(),
      BASE_URL,
      defaultManifest
    );
    expect(xml).toContain('<g:mpn>SKU-BLUE-128</g:mpn>');
  });
});
