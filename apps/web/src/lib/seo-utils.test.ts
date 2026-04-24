// src/lib/seo-utils.test.ts

import { describe, expect, it } from 'vitest';
import type { Product } from './products';
import {
  buildProductUrl,
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateMetaDescription,
  generateMetaTitle,
  generateOrganizationSchema,
  generateProductSchema,
  generateSlug,
  getEffectiveProductStock,
  getIndexableRobotsMetadata,
  getProductUrl,
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

  it('does not emit non-schema google_product_category on Product markup', () => {
    const product = makeProduct({
      google_product_category:
        'Electronics > Communications > Telephony > Mobile Phones',
    });
    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');

    expect(schema).not.toHaveProperty('google_product_category');
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

  it('includes brand, identifiers, description, color, and inferred size on variant product nodes', () => {
    const product = makeProduct({
      description: 'A flagship device with variant-specific merchandising.',
      brand: 'Samsung',
      gtin: '1234567890123',
      mpn: 'SM-S25-256-JB',
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: {
            color: 'Titanium Jetblack',
            storage: '256GB',
            ram: '12GB',
          },
          stock_quantity: 5,
        },
      ],
    });

    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');
    const variants = schema.hasVariant as Record<string, unknown>[];

    expect(variants[0]?.brand).toEqual({
      '@type': 'Brand',
      name: 'Samsung',
    });
    expect(variants[0]?.gtin).toBe('1234567890123');
    expect(variants[0]?.mpn).toBe('SM-S25-256-JB');
    expect(variants[0]?.description).toBe(
      'A flagship device with variant-specific merchandising.'
    );
    expect(variants[0]?.color).toBe('Titanium Jetblack');
    expect(variants[0]?.size).toBe('256GB / 12GB');
  });

  it('omits color and size when variant attributes do not provide them', () => {
    const product = makeProduct({
      variants: [
        {
          id: 'v1',
          product_id: 'test-123',
          merchant_id: 'm1',
          attributes: { processor: 'Snapdragon 8 Elite' },
          stock_quantity: 5,
        },
      ],
    });

    const schema = generateProductSchema(product, 'TestStore', 'USD', 'NG');
    const variants = schema.hasVariant as Record<string, unknown>[];

    expect(variants[0]?.description).toBe('A test product');
    expect(variants[0]).not.toHaveProperty('color');
    expect(variants[0]).not.toHaveProperty('size');
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

  it('extends short descriptions when minLength fallback options are provided', () => {
    expect(
      generateMetaDescription('2-in-1', 160, {
        minLength: 110,
        fallback:
          'Buy premium laptops in Nigeria with nationwide delivery and flexible payment options.',
      })
    ).toContain('Buy premium laptops in Nigeria');
  });

  it('uses the fallback description when the source description is empty', () => {
    expect(
      generateMetaDescription('', 160, {
        minLength: 110,
        fallback:
          'Compare smartphones, laptops, and accessories with trusted quality and fast delivery across Nigeria.',
      })
    ).toBe(
      'Compare smartphones, laptops, and accessories with trusted quality and fast delivery across Nigeria.'
    );
  });
});

describe('generateMetaTitle', () => {
  it('removes duplicated suffixes and keeps a single merchant suffix', () => {
    expect(
      generateMetaTitle('Buy Smartphones in Nigeria | Ogabassey | Ogabassey', {
        suffix: 'Ogabassey',
        maxLength: 70,
      })
    ).toBe('Buy Smartphones in Nigeria | Ogabassey');
  });

  it('adds suffix when missing and trims long titles', () => {
    const title = generateMetaTitle(
      "Introducing the iPhone 15 Series: Apple's Next Evolution in Smartphones",
      {
        suffix: 'Ogabassey',
        maxLength: 70,
      }
    );

    expect(title).toContain('Ogabassey');
    expect(title.length).toBeLessThanOrEqual(70);
  });

  it('deduplicates suffixes that include regex metacharacters', () => {
    expect(
      generateMetaTitle('Buy Smartphones | Oga(bassey)+? | Oga(bassey)+?', {
        suffix: 'Oga(bassey)+?',
        maxLength: 70,
      })
    ).toBe('Buy Smartphones | Oga(bassey)+?');
  });

  it('does not treat an inline substring as an existing suffix', () => {
    expect(
      generateMetaTitle('MacBook Pro 16', {
        suffix: 'Pro',
        maxLength: 70,
      })
    ).toBe('MacBook Pro 16 | Pro');
  });

  it('does not treat partial word matches as an existing suffix', () => {
    expect(
      generateMetaTitle('Restore your phone fast', {
        suffix: 'Store',
        maxLength: 70,
      })
    ).toBe('Restore your phone fast | Store');
  });
});

describe('getProductUrl', () => {
  it('falls back to the slug-based storefront path when canonical_url is absent', () => {
    expect(
      getProductUrl(
        makeProduct({
          category: 'Phones',
          slug: 'test-product',
        })
      )
    ).toBe('/smartphones/test-product');
  });

  it('uses a same-domain canonical_url without double-prefixing the path', () => {
    expect(
      getProductUrl(
        makeProduct({
          canonical_url: 'https://usebaci.com/products/test-product',
          slug: 'test-product',
        })
      )
    ).toBe('/products/test-product');
  });

  it('falls back predictably when canonical_url is malformed', () => {
    expect(
      getProductUrl(
        makeProduct({
          canonical_url: 'https://[invalid',
          slug: 'test-product',
        })
      )
    ).toBe('/products/test-product');
  });

  it('strips merchant-slug prefix from /{merchantSlug}/{category}/{product} canonicals when the second segment is a known storefront root', () => {
    // /ogabassey/smartphones/iphone-15 has 3 segments; `smartphones` is a
    // known storefront root, so `ogabassey` is recognized as the merchant
    // slug prefix and stripped, leaving /smartphones/iphone-15.
    expect(
      getProductUrl(
        makeProduct({
          canonical_url: 'https://usebaci.com/ogabassey/smartphones/iphone-15',
          slug: 'iphone-15',
        })
      )
    ).toBe('/smartphones/iphone-15');
  });

  it('does NOT strip the first segment of a 3-segment canonical when the second segment is not a known storefront root', () => {
    // Regression: previously `/phones/iphone-15/black` (3 segments) was
    // mis-rewritten to `/iphone-15/black` because the first segment was not
    // in STOREFRONT_ROOT_SEGMENTS. The guard now requires positive evidence
    // (a known storefront root in position 2) before stripping, so this 3+
    // segment canonical that doesn't match the merchant-prefix pattern
    // simply falls through to the slug-based fallback.
    expect(
      getProductUrl(
        makeProduct({
          canonical_url: 'https://usebaci.com/phones/iphone-15/black',
          slug: 'iphone-15',
          category: 'Phones',
        })
      )
    ).toBe('/smartphones/iphone-15');
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
          name: 'Ogabassey',
          item: 'https://ogabassey.com/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Smartphones',
          item: 'https://ogabassey.com/smartphones',
        },
      ],
    });
  });

  it('falls back to a root item URL when the caller passes an empty breadcrumb url', () => {
    const schema = generateBreadcrumbSchema([
      { name: 'Home', url: '' },
      { name: 'Gaming Accessories', url: '/gaming-accessories' },
    ]);

    expect(schema).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: '/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Gaming Accessories',
          item: '/gaming-accessories',
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

  it('includes brand plus shipping and return policy on collection-page product offers', () => {
    const schema = generateCollectionPageSchema({
      name: 'Smartphones',
      description: 'Shop smartphones',
      url: 'https://ogabassey.com/smartphones',
      merchantName: 'Ogabassey',
      currency: 'NGN',
      country: 'NG',
      trustProfile: makeTrustProfile({
        returnPolicy: {
          summary: 'Returns accepted within 10 days.',
          windowDays: 10,
          returnMethod: 'mail',
          returnFees: 'free',
          localRoute: '/returns',
        },
        shippingPolicy: {
          summary: 'Ships nationwide.',
          regions: ['NG'],
          handlingDaysMin: 1,
          handlingDaysMax: 2,
          transitDaysMin: 2,
          transitDaysMax: 4,
          shippingFeeType: 'free',
          localRoute: '/shipping',
        },
      }),
      products: [
        makeProduct({
          name: 'Galaxy S25 Edge',
          brand: 'Samsung',
          gtin: '0123456789012',
          image: '/images/galaxy-s25-edge.jpg',
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
    const offer = product.offers as Record<string, unknown>;
    const brand = product.brand as Record<string, unknown>;
    const shipping = offer.shippingDetails as Record<string, unknown>;
    const returnPolicy = offer.hasMerchantReturnPolicy as Record<
      string,
      unknown
    >;

    expect(brand).toEqual({
      '@type': 'Brand',
      name: 'Samsung',
    });
    expect(product.gtin).toBe('0123456789012');
    expect(shipping['@type']).toBe('OfferShippingDetails');
    expect(
      (shipping.shippingDestination as Record<string, unknown>).addressCountry
    ).toBe('NG');
    expect(returnPolicy['@type']).toBe('MerchantReturnPolicy');
    expect(returnPolicy.merchantReturnDays).toBe(10);
  });

  it('keeps unmanaged products InStock in collection offers', () => {
    const schema = generateCollectionPageSchema({
      name: 'Smartphones',
      description: 'Shop smartphones',
      url: 'https://ogabassey.com/smartphones',
      merchantName: 'Ogabassey',
      currency: 'NGN',
      products: [
        makeProduct({
          name: 'Galaxy S25',
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
    const offer = product.offers as Record<string, unknown>;

    expect(offer.availability).toBe('https://schema.org/InStock');
  });

  it('stores numberOfItems on ItemList (not CollectionPage)', () => {
    const schema = generateCollectionPageSchema({
      name: 'Smartphones',
      description: 'Shop smartphones',
      url: 'https://ogabassey.com/smartphones',
      merchantName: 'Ogabassey',
      currency: 'NGN',
      products: [
        makeProduct({ name: 'Galaxy S25' }),
        makeProduct({ id: 'p2', name: 'iPhone 16' }),
      ],
    });

    const itemList = schema.mainEntity as Record<string, unknown>;

    expect(schema).not.toHaveProperty('numberOfItems');
    expect(itemList.numberOfItems).toBe(2);
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

  it('keeps condition offers as InStock when manage_stock is disabled', () => {
    const schema = generateProductSchema(
      makeProduct({
        manage_stock: false,
        has_condition_offers: true,
        offers: [
          {
            id: 'offer-unmanaged',
            condition: 'new',
            price: 500000,
            stock_quantity: 0,
          },
        ],
      }),
      'TestStore',
      'NGN',
      'NG'
    );

    const availability = (
      (schema.offers as Record<string, unknown>[])[0] as Record<string, unknown>
    ).availability;

    expect(availability).toBe('https://schema.org/InStock');
  });

  it('keeps variant offers as InStock when manage_stock is disabled', () => {
    const schema = generateProductSchema(
      makeProduct({
        manage_stock: false,
        has_variants: true,
        variants: [
          {
            id: 'variant-unmanaged',
            product_id: 'test-123',
            merchant_id: 'm1',
            condition: 'new',
            attributes: { storage: '128GB' },
            price_override: 500000,
            stock_quantity: 0,
          },
        ],
      }),
      'TestStore',
      'NGN',
      'NG'
    );

    const variants = schema.hasVariant as Record<string, unknown>[];
    const availability = (variants[0]?.offers as Record<string, unknown>)
      .availability;

    expect(availability).toBe('https://schema.org/InStock');
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

describe('getProductUrl — canonical metadata path guards', () => {
  it('reuses canonical product paths only when they match supported product routes', () => {
    expect(
      getProductUrl({
        id: 'test-123',
        name: 'Canon Phone',
        slug: 'canon-phone',
        canonical_url: 'https://store.example.com/products/canon-phone',
      })
    ).toBe('/products/canon-phone');

    expect(
      getProductUrl({
        id: 'test-123',
        name: 'Canon Phone',
        slug: 'canon-phone',
        categorySlug: 'smartphones',
        canonical_url: 'https://store.example.com/sale',
      })
    ).toBe('/smartphones/canon-phone');

    expect(
      getProductUrl({
        id: 'test-123',
        name: 'Canon Phone',
        slug: 'canon-phone',
        categorySlug: 'smartphones',
        canonical_url: 'https://store.example.com/blog/canon-phone',
      })
    ).toBe('/smartphones/canon-phone');
  });

  it('ignores canonical URLs that point at sitemap-like metadata roots', () => {
    const metadataCanonicals = [
      'https://store.example.com/sitemap/products.xml',
      'https://store.example.com/sitemap.xml',
      'https://store.example.com/robots.txt',
      'https://store.example.com/manifest/app.webmanifest',
      'https://store.example.com/opengraph-image/canon-phone',
      'https://store.example.com/rss/canon-phone',
      'https://store.example.com/api/canon-phone',
    ];

    for (const canonicalUrl of metadataCanonicals) {
      expect(
        getProductUrl({
          id: 'test-123',
          name: 'Canon Phone',
          slug: 'canon-phone',
          categorySlug: 'smartphones',
          canonical_url: canonicalUrl,
        })
      ).toBe('/smartphones/canon-phone');
    }
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

describe('buildProductUrl — preserves raw category slug (no alias remap)', () => {
  // Regression tests: the product detail route redirects when the URL
  // category segment does not match the product's stored `category_slug`
  // (see apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx).
  // If the canonical URL builder remapped legacy slugs (e.g. `phones` ->
  // `smartphones`), products with those legacy slugs would permanently
  // redirect to the normalized URL, which then mismatches the raw DB slug
  // and redirects again — a self-redirect loop. The builder must therefore
  // preserve the merchant's stored slug verbatim (aside from trim/lowercase).

  it('preserves `phones` without remapping to `smartphones`', () => {
    expect(buildProductUrl('iphone-12', null, 'phones')).toBe(
      '/phones/iphone-12'
    );
  });

  it('preserves `macbook` without remapping to `laptops`', () => {
    expect(buildProductUrl('macbook-air-m2', null, 'macbook')).toBe(
      '/macbook/macbook-air-m2'
    );
  });

  it('preserves `samsung` without remapping to `smartphones`', () => {
    expect(buildProductUrl('galaxy-s23', null, 'samsung')).toBe(
      '/samsung/galaxy-s23'
    );
  });

  it('preserves `accesories` typo verbatim (DB slug is source of truth)', () => {
    expect(buildProductUrl('usb-cable', null, 'accesories')).toBe(
      '/accesories/usb-cable'
    );
  });

  it('lowercases and trims the category slug', () => {
    expect(buildProductUrl('item', null, '  Gaming  ')).toBe('/gaming/item');
  });

  it('falls back to /products/{slug} when no category is provided', () => {
    expect(buildProductUrl('generic-item', null, null)).toBe(
      '/products/generic-item'
    );
  });

  it('preserves raw slug when category passed as object', () => {
    expect(
      buildProductUrl('iphone-12', { name: 'Phones', slug: 'phones' })
    ).toBe('/phones/iphone-12');
  });

  it('prefers object category slug over fallback categorySlug arg', () => {
    expect(
      buildProductUrl(
        'iphone-12',
        { name: 'Phones', slug: 'phones' },
        'ignored'
      )
    ).toBe('/phones/iphone-12');
  });
});

describe('getProductUrl — no self-redirect loop for legacy-slug products', () => {
  it('builds canonical URL matching the stored DB category_slug', () => {
    // Simulate a product whose DB category_slug is the legacy alias.
    // The canonical URL must use the raw slug so the product route's
    // category-mismatch check (raw DB slug vs URL segment) does not fire.
    const url = getProductUrl({
      id: 'p1',
      name: 'iPhone 12',
      slug: 'iphone-12',
      categories: { name: 'Phones', slug: 'phones' },
      category_slug: 'phones',
    });
    expect(url).toBe('/phones/iphone-12');
  });

  it('respects an explicit canonical_url without alias-remapping it', () => {
    const url = getProductUrl({
      id: 'p2',
      name: 'MacBook Air',
      slug: 'macbook-air-m2',
      canonical_url: 'https://store.example.com/macbook/macbook-air-m2',
    });
    expect(url).toBe('/macbook/macbook-air-m2');
  });
});
