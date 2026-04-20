// src/lib/seo-utils.test.ts

import { describe, expect, it } from 'vitest';
import type { Product } from './products';
import {
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateMetaDescription,
  generateOrganizationSchema,
  generateProductSchema,
  generateSlug,
  getEffectiveProductStock,
  getIndexableRobotsMetadata,
} from './seo-utils';
import type { MerchantTrustProfile } from './storefront-trust/merchant-trust-profile-types';

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

function makeTrustProfile(
  overrides: Partial<MerchantTrustProfile> = {}
): MerchantTrustProfile {
  return {
    socialLinks: {},
    derivedLinks: {},
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

  it('keeps google_product_category out of schema.org product markup', () => {
    const schema = generateProductSchema(
      makeProduct({
        google_product_category:
          'Electronics > Communications > Telephony > Mobile Phones',
      }),
      'TestStore',
      'USD',
      'NG'
    );

    expect(schema.google_product_category).toBeUndefined();
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

  it('reports InStock for unmanaged-stock product offers even when stock counters are zero', () => {
    // Single-offer fallback (no variants, no offers array).
    const product = makeProduct({ manage_stock: false, stock: 0 });
    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');
    const productOffer = schema.offers as Record<string, unknown>;
    expect(productOffer.availability).toBe('https://schema.org/InStock');
  });

  it('reports InStock for unmanaged-stock variant offers even when variant.stock_quantity is 0', () => {
    const product = makeProduct({
      manage_stock: false,
      stock: 0,
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { storage: '128GB' },
          stock_quantity: 0,
        },
      ],
    });
    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');
    const variants = schema.hasVariant as Record<string, unknown>[];
    const v1Offer = variants[0].offers as Record<string, unknown>;
    expect(v1Offer.availability).toBe('https://schema.org/InStock');
  });

  it('reports InStock for unmanaged-stock per-condition offers even when stock_quantity is 0', () => {
    // Condition-based offers array path (no variants): each offer entry
    // produces its own Offer node and must honour manage_stock=false.
    const product = makeProduct({
      manage_stock: false,
      stock: 0,
      has_condition_offers: true,
      offers: [
        {
          id: 'offer-new',
          condition: 'new',
          price: 100,
          stock_quantity: 0,
        },
        {
          id: 'offer-used',
          condition: 'used',
          price: 80,
          stock_quantity: 0,
        },
      ],
    });
    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');
    const offers = schema.offers as Record<string, unknown>[];
    expect(Array.isArray(offers)).toBe(true);
    expect(offers).toHaveLength(2);
    expect(offers[0].availability).toBe('https://schema.org/InStock');
    expect(offers[1].availability).toBe('https://schema.org/InStock');
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

  it('uses structured trust profile shipping and return settings instead of hardcoded defaults', () => {
    const schema = generateProductSchema(
      makeProduct({
        variants: [
          {
            id: 'v1',
            product_id: 'test-123',
            merchant_id: 'm1',
            attributes: { storage: '128GB' },
            stock_quantity: 5,
          },
        ],
      }),
      'TestStore',
      'NGN',
      'NG',
      undefined,
      makeTrustProfile({
        returnPolicy: {
          summary: 'Returns accepted within 14 days.',
          windowDays: 14,
          returnMethod: 'mail',
          returnFees: 'customer_pays',
          localRoute: '/returns',
        },
        shippingPolicy: {
          summary: 'Ships across Nigeria.',
          regions: ['NG'],
          handlingDaysMin: 2,
          handlingDaysMax: 4,
          transitDaysMin: 6,
          transitDaysMax: 8,
          shippingFeeType: 'free',
          localRoute: '/shipping',
        },
      })
    );

    const offer = (schema.hasVariant as Record<string, unknown>[])[0]
      .offers as Record<string, unknown>;
    const shipping = offer.shippingDetails as Record<string, unknown>;
    const returnPolicy = offer.hasMerchantReturnPolicy as Record<
      string,
      unknown
    >;
    const deliveryTime = shipping.deliveryTime as Record<string, unknown>;
    const handlingTime = deliveryTime.handlingTime as Record<string, unknown>;
    const transitTime = deliveryTime.transitTime as Record<string, unknown>;

    expect(handlingTime.minValue).toBe(2);
    expect(handlingTime.maxValue).toBe(4);
    expect(transitTime.minValue).toBe(6);
    expect(transitTime.maxValue).toBe(8);
    expect(returnPolicy.merchantReturnDays).toBe(14);
    expect(returnPolicy.returnMethod).toBe('https://schema.org/ReturnByMail');
    expect(returnPolicy.returnFees).toBe(
      'https://schema.org/ReturnShippingFees'
    );
  });

  it('strips HTML tags from structured product descriptions', () => {
    const schema = generateProductSchema(
      makeProduct({
        description:
          '<p>The <strong>best</strong> gaming laptop for creators.</p>',
      }),
      'TestStore',
      'USD',
      'NG'
    );

    expect(schema.description).toBe('The best gaming laptop for creators.');
  });
});

describe('getIndexableRobotsMetadata', () => {
  it('returns large-preview directives for indexable storefront pages', () => {
    expect(getIndexableRobotsMetadata()).toEqual({
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    });
  });
});

describe('generateOrganizationSchema', () => {
  it('adds normalized sameAs, contactPoint, foundingDate, and return policy from the trust profile', () => {
    const schema = generateOrganizationSchema({
      name: 'Test Store',
      url: 'https://test.example',
      country: 'NG',
      logo: 'https://cdn.example.com/logo.png',
      trustProfile: makeTrustProfile({
        supportEmail: 'support@test.example',
        supportPhone: '+2348000000000',
        foundedYear: 2018,
        socialLinks: {
          instagram: 'https://instagram.com/teststore',
          twitter: 'https://x.com/teststore',
        },
        returnPolicy: {
          summary: 'Returns accepted for 7 days.',
          windowDays: 7,
          returnMethod: 'carrier_dropoff',
          returnFees: 'free',
          localRoute: '/returns',
        },
      }),
    });

    expect(schema).toMatchObject({
      '@type': 'OnlineStore',
      foundingDate: '2018',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'support@test.example',
        telephone: '+2348000000000',
        availableLanguage: 'English',
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'NG',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    });

    expect(schema.sameAs).toEqual(
      expect.arrayContaining([
        'https://instagram.com/teststore',
        'https://x.com/teststore',
      ])
    );
  });
});

describe('generateMetaDescription', () => {
  it('returns plain text for HTML content', () => {
    expect(
      generateMetaDescription(
        '<p>Shop <strong>phones</strong>, laptops and consoles.</p>'
      )
    ).toBe('Shop phones, laptops and consoles.');
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

  it('reports InStock for unmanaged-stock items in CollectionPage itemList offers even when stock is 0', () => {
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
          manage_stock: false,
          stock: 0,
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

    expect(offers.availability).toBe('https://schema.org/InStock');
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

  it('maps per-variant offer conditions independently inside ProductGroup schema', () => {
    const schema = generateProductSchema(
      makeProduct({
        condition: 'new',
        variants: [
          {
            id: 'variant-open-box',
            product_id: 'test-123',
            merchant_id: 'm1',
            condition: 'open_box',
            attributes: { storage: '128GB' },
            price_override: 500000,
            stock_quantity: 3,
          },
          {
            id: 'variant-new',
            product_id: 'test-123',
            merchant_id: 'm1',
            condition: 'new',
            attributes: { storage: '256GB' },
            price_override: 650000,
            stock_quantity: 5,
          },
        ],
      }),
      'TestStore',
      'NGN',
      'NG'
    );

    const variants = schema.hasVariant as Record<string, unknown>[];
    const firstOffer = variants[0]?.offers as Record<string, unknown>;
    const secondOffer = variants[1]?.offers as Record<string, unknown>;

    expect(firstOffer.itemCondition).toBe(
      'https://schema.org/RefurbishedCondition'
    );
    expect(secondOffer.itemCondition).toBe('https://schema.org/NewCondition');
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
