// src/lib/seo-utils.test.ts

import { describe, expect, it } from 'vitest';
import type { Product } from './products';
import {
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateProductSchema,
  generateSlug,
  getEffectiveProductStock,
} from './seo-utils';

/** Helper to create a minimal Product for testing */
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-123',
    name: 'Test Product',
    description: 'A test product',
    status: 'active',
    price: 100,
    manage_stock: true,
    stock: 10,
    image: 'https://example.com/img.jpg',
    imageLarge: 'https://example.com/img-lg.jpg',
    imageHint: 'test',
    brand: 'TestBrand',
    gtin: '',
    mpn: '',
    ...overrides,
  };
}

describe('generateProductSchema - ProductGroup for variant products', () => {
  it('outputs @type Product when no variants', () => {
    const product = makeProduct();
    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');

    expect(schema['@type']).toBe('Product');
    expect(schema.productGroupID).toBeUndefined();
    expect(schema.hasVariant).toBeUndefined();
    expect(schema.variesBy).toBeUndefined();
  });

  it('outputs @type ProductGroup when variants exist', () => {
    const product = makeProduct({
      slug: 'test-product',
      has_variants: true,
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '128GB' },
          price_override: 90,
          stock_quantity: 5,
        },
        {
          id: 'v2',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '256GB' },
          price_override: 120,
          stock_quantity: 3,
        },
      ],
    });

    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');

    expect(schema['@type']).toBe('ProductGroup');
    expect(schema.productGroupID).toBe('test-product');
  });

  it('removes top-level offers on ProductGroup (Google 2026 guideline)', () => {
    const product = makeProduct({
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '128GB' },
          price_override: 50,
          stock_quantity: 5,
        },
        {
          id: 'v2',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '256GB' },
          price_override: 200,
          stock_quantity: 3,
        },
      ],
    });

    const schema = generateProductSchema(product, 'TestStore', 'NGN', 'NG');

    // Google says: Don't use AggregateOffer for product variants
    // Offers belong on individual variant Products only
    expect(schema.offers).toBeUndefined();
  });

  it('puts correct Offer on each hasVariant entry with fallback to parent price', () => {
    const product = makeProduct({
      price: 100,
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '128GB' },
          stock_quantity: 5,
        },
        {
          id: 'v2',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '256GB' },
          price_override: 150,
          stock_quantity: 3,
        },
      ],
    });

    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');
    const variants = schema.hasVariant as Record<string, unknown>[];
    const v1Offer = variants[0].offers as Record<string, unknown>;
    const v2Offer = variants[1].offers as Record<string, unknown>;

    expect(v1Offer['@type']).toBe('Offer');
    expect(v1Offer.price).toBe(100); // Falls back to parent price
    expect(v1Offer.priceCurrency).toBe('USD');

    expect(v2Offer['@type']).toBe('Offer');
    expect(v2Offer.price).toBe(150); // Uses price_override
  });

  it('includes hasVariant array with correct variant names', () => {
    const product = makeProduct({
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '128GB', ram: '8GB' },
          price_override: 90,
          stock_quantity: 5,
        },
      ],
    });

    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');
    const variants = schema.hasVariant as Record<string, unknown>[];

    expect(variants).toHaveLength(1);
    expect(variants[0]['@type']).toBe('Product');
    expect(variants[0].name).toBe('Test Product - 128GB / 8GB');
    expect(variants[0].sku).toBe('v1');
  });

  it('computes variesBy with deduplication and excludes unsupported keys', () => {
    const product = makeProduct({
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: {
            storage: '128GB',
            ram: '8GB',
            color: 'Black',
            processor: 'M3',
          },
          stock_quantity: 5,
        },
        {
          id: 'v2',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: {
            storage: '256GB',
            ram: '16GB',
            color: 'White',
            processor: 'M3 Pro',
          },
          stock_quantity: 3,
        },
      ],
    });

    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');
    const variesBy = schema.variesBy as string[];

    // storage and ram both map to schema.org/size — should be deduplicated
    expect(variesBy).toContain('https://schema.org/size');
    expect(variesBy).toContain('https://schema.org/color');
    // 'processor' is not a Google-supported variesBy value — excluded
    expect(variesBy).not.toContain('https://schema.org/additionalProperty');
    // Exactly 2 unique values: size + color
    expect(variesBy).toHaveLength(2);
  });

  it('sets variant-level availability correctly', () => {
    const product = makeProduct({
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '128GB' },
          stock_quantity: 0,
        },
        {
          id: 'v2',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '256GB' },
          stock_quantity: 5,
        },
      ],
    });

    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');
    const variants = schema.hasVariant as Record<string, unknown>[];

    const v1Offer = variants[0].offers as Record<string, unknown>;
    const v2Offer = variants[1].offers as Record<string, unknown>;

    expect(v1Offer.availability).toBe('https://schema.org/OutOfStock');
    expect(v2Offer.availability).toBe('https://schema.org/InStock');
  });

  it('includes variant-level images with fallback to parent images', () => {
    const product = makeProduct({
      images: [
        { url: 'https://cdn.example.com/parent.avif', alt: 'Parent', order: 0 },
      ],
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { color: 'Black' },
          images: ['https://cdn.example.com/black.avif'],
          stock_quantity: 5,
        },
        {
          id: 'v2',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { color: 'White' },
          stock_quantity: 3,
          // No variant images — should fall back to parent
        },
      ],
    });

    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');
    const variants = schema.hasVariant as Record<string, unknown>[];

    // v1 has its own images
    expect(variants[0].image).toEqual(['https://cdn.example.com/black.avif']);
    // v2 falls back to parent images
    expect(variants[1].image).toEqual(['https://cdn.example.com/parent.avif']);
  });

  it('includes shippingDetails and returnPolicy on variant Offers (2026 best practice)', () => {
    const product = makeProduct({
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '128GB' },
          stock_quantity: 5,
        },
      ],
    });

    const schema = generateProductSchema(product, 'TestStore', 'NGN', 'NG');
    const variants = schema.hasVariant as Record<string, unknown>[];
    const offer = variants[0].offers as Record<string, unknown>;

    // priceValidUntil is a YYYY-MM-DD string
    expect(offer.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // shippingDetails
    const shipping = offer.shippingDetails as Record<string, unknown>;
    expect(shipping['@type']).toBe('OfferShippingDetails');
    const dest = shipping.shippingDestination as Record<string, unknown>;
    expect(dest.addressCountry).toBe('NG');

    // returnPolicy
    const returnPolicy = offer.hasMerchantReturnPolicy as Record<
      string,
      unknown
    >;
    expect(returnPolicy['@type']).toBe('MerchantReturnPolicy');
    expect(returnPolicy.applicableCountry).toBe('NG');
    expect(returnPolicy.merchantReturnDays).toBe(7);
  });
});

describe('generateBreadcrumbSchema', () => {
  it('emits breadcrumb items as schema objects with absolute ids', () => {
    const schema = generateBreadcrumbSchema([
      { name: 'Ogabassey', url: 'https://ogabassey.com' },
      { name: 'Smartphones', url: 'https://ogabassey.com/smartphones' },
    ]);

    expect(schema).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          item: {
            '@id': 'https://ogabassey.com',
            name: 'Ogabassey',
          },
        },
        {
          '@type': 'ListItem',
          position: 2,
          item: {
            '@id': 'https://ogabassey.com/smartphones',
            name: 'Smartphones',
          },
        },
      ],
    });
  });
});

describe('generateCollectionPageSchema', () => {
  it('converts product and image URLs to absolute schema URLs', () => {
    const schema = generateCollectionPageSchema({
      name: 'Smartphones',
      description: 'Shop smartphones',
      url: 'https://ogabassey.com/smartphones',
      merchantName: 'Ogabassey',
      currency: 'NGN',
      products: [
        makeProduct({
          name: 'iPhone 16',
          slug: 'iphone-16',
          category: 'Smartphones',
          image: '/images/iphone-16.jpg',
          imageLarge: '/images/iphone-16-large.jpg',
        }),
      ],
    });

    const listItem = (
      (schema.mainEntity as Record<string, unknown>).itemListElement as Record<
        string,
        unknown
      >[]
    )[0];
    const product = listItem.item as Record<string, unknown>;
    const offers = product.offers as Record<string, unknown>;

    expect(schema.url).toBe('https://ogabassey.com/smartphones');
    expect(product.url).toBe('https://ogabassey.com/smartphones/iphone-16');
    expect(product.image).toBe(
      'https://ogabassey.com/images/iphone-16-large.jpg'
    );
    expect(offers.url).toBe('https://ogabassey.com/smartphones/iphone-16');
  });

  it('omits the page url when the collection URL cannot be normalized', () => {
    const schema = generateCollectionPageSchema({
      name: 'Smartphones',
      description: 'Shop smartphones',
      url: 'not-a-valid-url',
      merchantName: 'Ogabassey',
      currency: 'NGN',
      products: [],
    });

    expect(schema.url).toBeUndefined();
  });

  it('preserves query parameters in JSON-LD URL fields without HTML escaping', () => {
    const schema = generateCollectionPageSchema({
      name: 'Smartphones',
      description: 'Shop smartphones',
      url: 'https://ogabassey.com/smartphones?sort=popular&ref=home',
      merchantName: 'Ogabassey',
      currency: 'NGN',
      products: [
        makeProduct({
          name: 'iPhone 16',
          slug: 'iphone-16',
          category: 'Smartphones',
          image: '/images/iphone-16.jpg?fit=cover&width=600',
          imageLarge: '/images/iphone-16-large.jpg?fit=cover&width=1200',
        }),
      ],
    });

    const listItem = (
      (schema.mainEntity as Record<string, unknown>).itemListElement as Record<
        string,
        unknown
      >[]
    )[0];
    const product = listItem.item as Record<string, unknown>;

    expect(schema.url).toBe(
      'https://ogabassey.com/smartphones?sort=popular&ref=home'
    );
    expect(product.image).toBe(
      'https://ogabassey.com/images/iphone-16-large.jpg?fit=cover&width=1200'
    );
  });
});

describe('generateProductSchema - condition mapping', () => {
  it('maps open_box product conditions to RefurbishedCondition', () => {
    const schema = generateProductSchema(
      makeProduct({ condition: 'open_box' }),
      'TestStore',
      'NGN',
      'NG'
    );

    expect((schema.offers as Record<string, unknown>).itemCondition).toBe(
      'https://schema.org/RefurbishedCondition'
    );
  });

  it('maps open_box offer conditions to RefurbishedCondition', () => {
    const schema = generateProductSchema(
      makeProduct({
        has_condition_offers: true,
        offers: [
          {
            id: 'offer-open-box',
            condition: 'open_box',
            price: 500000,
            stock_quantity: 3,
          },
        ],
      }),
      'TestStore',
      'NGN',
      'NG'
    );

    expect(
      (
        (schema.offers as Record<string, unknown>[])[0] as Record<
          string,
          unknown
        >
      ).itemCondition
    ).toBe('https://schema.org/RefurbishedCondition');
  });
});

describe('generateSlug', () => {
  it('should convert a simple string to a slug', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('should handle strings with multiple spaces', () => {
    expect(generateSlug('Hello   World')).toBe('hello-world');
  });

  it('should remove special characters', () => {
    expect(generateSlug('Hello World!@#$%^&*()')).toBe('hello-world');
  });

  it('should handle leading and trailing spaces', () => {
    expect(generateSlug('  Hello World  ')).toBe('hello-world');
  });

  it('should handle leading and trailing dashes', () => {
    expect(generateSlug('--Hello-World--')).toBe('hello-world');
  });

  it('should handle multiple dashes in a row', () => {
    expect(generateSlug('Hello--World')).toBe('hello-world');
  });

  it('should handle an empty string', () => {
    expect(generateSlug('')).toBe('');
  });
});

describe('getEffectiveProductStock', () => {
  it('uses stock_quantity when it reflects the current positive stock', () => {
    expect(
      getEffectiveProductStock({
        stock: 0,
        stock_quantity: 4,
      })
    ).toBe(4);
  });

  it('falls back to legacy stock when stock_quantity drifted to zero', () => {
    expect(
      getEffectiveProductStock({
        stock: 12,
        stock_quantity: 0,
      })
    ).toBe(12);
  });

  it('falls back to legacy stock when stock_quantity is missing', () => {
    expect(
      getEffectiveProductStock({
        stock: 7,
        stock_quantity: null,
      })
    ).toBe(7);
  });
});
