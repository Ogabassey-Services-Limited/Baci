import { describe, expect, it } from 'vitest';
import type { FeedProduct } from '@/app/api/feed/google-merchant/feed-builder';
import type { GoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import type { OpenAIFeedProduct } from '@/app/api/feed/openai/feed-data';
import type { FeedImageManifestEntry } from '@/lib/gmc-feed-images';
import { buildAgentCommerceTrustReadiness } from './build-agent-commerce-trust-readiness';
import type { MerchantTrustProfile } from './merchant-trust-profile-types';

const NOW = new Date('2026-05-15T00:00:00.000Z');
const PRODUCT_UPDATED_AT = '2026-05-10T00:00:00.000Z';

function product(
  overrides: Partial<OpenAIFeedProduct> = {}
): OpenAIFeedProduct {
  return {
    id: 'product-1',
    name: 'Samsung Galaxy S25',
    description: 'Flagship phone',
    slug: 'samsung-galaxy-s25',
    price: 500_000,
    stock: 5,
    stock_quantity: 5,
    manage_stock: true,
    category: 'phones',
    average_rating: 4.7,
    review_count: 24,
    updated_at: PRODUCT_UPDATED_AT,
    ...overrides,
  };
}

function googleProduct(overrides: Partial<FeedProduct> = {}): FeedProduct {
  return {
    id: 'product-1',
    name: 'Samsung Galaxy S25',
    description: 'Flagship phone',
    slug: 'samsung-galaxy-s25',
    price: 500_000,
    stock: 5,
    stock_quantity: 5,
    manage_stock: true,
    category: 'phones',
    ...overrides,
  };
}

function verifiedImage(): FeedImageManifestEntry {
  return {
    verified_url: 'https://cdn.example.com/product-1.jpg',
    verified_format: 'jpeg',
    status: 'verified',
    is_primary: true,
    position: 0,
  };
}

function trustProfile(
  overrides: Partial<MerchantTrustProfile> = {}
): MerchantTrustProfile {
  return {
    derivedLinks: {
      privacy: 'https://ogabassey.com/privacy',
      returns: 'https://ogabassey.com/returns',
      shipping: 'https://ogabassey.com/shipping',
      terms: 'https://ogabassey.com/terms',
    },
    returnPolicy: {
      localRoute: '/returns',
      summary: '7-day returns.',
      windowDays: 7,
    },
    shippingPolicy: {
      localRoute: '/shipping',
      regions: ['NG'],
      summary: 'Nationwide shipping.',
    },
    socialLinks: {},
    supportEmail: 'support@ogabassey.com',
    ...overrides,
  };
}

function googleFeedData(
  overrides: Partial<GoogleMerchantFeedData> = {}
): GoogleMerchantFeedData {
  return {
    custom_domain: 'ogabassey.com',
    imageManifest: {
      'product-1': [verifiedImage()],
    },
    products: [googleProduct()],
    slug: 'ogabassey',
    ...overrides,
  };
}

describe('buildAgentCommerceTrustReadiness', () => {
  it('passes when catalog, URL, price, policy, contact, and image signals align', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: googleFeedData(),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [product()],
      },
      trustProfile: trustProfile(),
    });

    expect(result.status).toBe('pass');
    expect(result.totals).toMatchObject({
      googleProducts: 1,
      openAiProducts: 1,
      priceMismatches: 0,
      sharedProducts: 1,
      urlMismatches: 0,
      productsWithVerifiedImages: 1,
      latestProductUpdatedAt: PRODUCT_UPDATED_AT,
      productsWithStructuredData: 1,
      staleProducts: 0,
    });
    expect(result.surfaces.agentNativeCommerce).toBe(
      'https://ogabassey.com/.well-known/agent-native-commerce'
    );
    expect(result.surfaces.agentTrust).toBe(
      'https://ogabassey.com/agent-trust.json'
    );
    expect(result.surfaces.robots).toBe('https://ogabassey.com/robots.txt');
    expect(result.surfaces.sitemap).toBe('https://ogabassey.com/sitemap.xml');
    expect(result.surfaces.llms).toBe('https://ogabassey.com/llms.txt');
    expect(result.surfaces.ucpProfile).toBe(
      'https://ogabassey.com/.well-known/ucp'
    );
    expect(
      result.checks.find((check) => check.id === 'structured-data-readiness')
    ).toMatchObject({ severity: 'pass' });
    expect(
      result.checks.find((check) => check.id === 'review-signal-coverage')
    ).toMatchObject({ severity: 'pass' });
    expect(
      result.checks.find((check) => check.id === 'feed-freshness')
    ).toMatchObject({ severity: 'pass' });
    expect(
      result.checks.find((check) => check.id === 'crawler-visibility')
    ).toMatchObject({ severity: 'pass' });
    expect(
      result.checks.find((check) => check.id === 'machine-endpoint-discovery')
    ).toMatchObject({ severity: 'pass' });
  });

  it('passes review trust with merchant Google review authority when product review coverage is missing', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: googleFeedData(),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [
          product({
            average_rating: null,
            review_count: null,
          }),
        ],
      },
      trustProfile: trustProfile({
        merchantReviewAuthority: {
          attributionLabel: 'Google Maps',
          businessName: 'Ogabassey',
          googleMapsUrl: 'https://maps.google.com/?cid=ogabassey',
          placeId: 'ChIJ1234',
          rating: 4.8,
          reviewsSortedBy: 'relevance',
          source: 'google_maps',
          totalReviews: 217,
        },
      }),
    });

    expect(result.status).toBe('pass');
    expect(result.merchantReviewAuthority).toMatchObject({
      attributionLabel: 'Google Maps',
      googleMapsUrl: 'https://maps.google.com/?cid=ogabassey',
      placeId: 'ChIJ1234',
      rating: 4.8,
      source: 'google_maps',
      totalReviews: 217,
    });
    expect(
      result.checks.find((check) => check.id === 'merchant-review-authority')
    ).toMatchObject({
      label: 'Merchant review authority',
      severity: 'pass',
    });
    expect(
      result.checks.find((check) => check.id === 'review-signal-coverage')
    ).toMatchObject({
      affectedProductCount: 0,
      message:
        '0 of 1 agent-visible products have product-level review metadata; verified merchant-level Google review authority satisfies review trust for this catalog.',
      severity: 'pass',
    });
  });

  it('does not use unverified Google review settings as fallback trust for missing product reviews', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: googleFeedData(),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [
          product({
            average_rating: null,
            review_count: null,
          }),
        ],
      },
      trustProfile: trustProfile({
        merchantReviewAuthority: {
          attributionLabel: 'Google Maps',
          placeId: 'ChIJ1234',
          reviewsSortedBy: 'relevance',
          source: 'google_maps',
        },
      }),
    });

    expect(result.status).toBe('fail');
    expect(
      result.checks.find((check) => check.id === 'merchant-review-authority')
    ).toMatchObject({
      severity: 'warn',
    });
    expect(
      result.checks.find((check) => check.id === 'review-signal-coverage')
    ).toMatchObject({
      message:
        '0 of 1 agent-visible products have usable review count and rating metadata.',
      severity: 'fail',
    });
  });

  it('fails when a product is missing from one catalog surface', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: googleFeedData({
        products: [googleProduct({ id: 'product-2', slug: 'pixel-10' })],
      }),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [product()],
      },
      trustProfile: trustProfile(),
    });

    expect(result.status).toBe('fail');
    expect(
      result.checks.find((check) => check.id === 'catalog-surface-parity')
    ).toMatchObject({
      affectedProductIds: ['product-1', 'product-2'],
      severity: 'fail',
    });
  });

  it('fails when canonical URLs or base prices drift between feed sources', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: googleFeedData({
        products: [googleProduct({ price: 520_000 })],
      }),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [
          product({
            canonical_url: 'https://ogabassey.com/phones/old-url',
          }),
        ],
      },
      trustProfile: trustProfile(),
    });

    expect(result.status).toBe('fail');
    expect(result.totals).toMatchObject({
      priceMismatches: 1,
      urlMismatches: 1,
    });
    expect(
      result.checks.find((check) => check.id === 'canonical-url-parity')
    ).toMatchObject({
      affectedProductIds: ['product-1'],
      severity: 'fail',
    });
    expect(
      result.checks.find((check) => check.id === 'price-parity')
    ).toMatchObject({
      affectedProductIds: ['product-1'],
      severity: 'fail',
    });
  });

  it('does not flag canonical drift for products that need path encoding', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com/',
      googleFeedData: googleFeedData({
        products: [
          googleProduct({
            id: 'product-encoded',
            name: 'Watch Pro GPS',
            slug: 'watch pro + gps',
            category: 'Smart Watches',
          }),
        ],
      }),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [
          product({
            id: 'product-encoded',
            name: 'Watch Pro GPS',
            slug: 'watch pro + gps',
            category: 'Smart Watches',
          }),
        ],
      },
      trustProfile: trustProfile(),
    });

    expect(result.totals.urlMismatches).toBe(0);
    expect(
      result.checks.find((check) => check.id === 'canonical-url-parity')
    ).toMatchObject({
      severity: 'pass',
    });
  });

  it('warns for partial verified image coverage and fails missing support basics', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: googleFeedData({
        imageManifest: {
          'product-1': [verifiedImage()],
        },
        products: [
          googleProduct(),
          googleProduct({
            id: 'product-2',
            name: 'Pixel 10',
            slug: 'pixel-10',
          }),
        ],
      }),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [
          product(),
          product({
            id: 'product-2',
            name: 'Pixel 10',
            review_count: null,
            slug: 'pixel-10',
          }),
        ],
      },
      trustProfile: trustProfile({
        returnPolicy: undefined,
        shippingPolicy: undefined,
        supportEmail: undefined,
      }),
    });

    expect(result.status).toBe('fail');
    expect(result.totals.productsWithVerifiedImages).toBe(1);
    expect(
      result.checks.find((check) => check.id === 'verified-image-coverage')
    ).toMatchObject({ affectedProductCount: 1, severity: 'warn' });
    expect(
      result.checks.find((check) => check.id === 'policy-coverage')
    ).toMatchObject({ affectedProductCount: 2, severity: 'warn' });
    expect(
      result.checks.find((check) => check.id === 'review-signal-coverage')
    ).toMatchObject({
      next_step_url: '/dashboard/reviews',
      severity: 'warn',
    });
    expect(
      result.checks.find((check) => check.id === 'support-contact')
    ).toMatchObject({ severity: 'fail' });
  });

  it('treats a missing image manifest as zero verified images instead of failing', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: {
        ...googleFeedData(),
        imageManifest: undefined,
      } as unknown as GoogleMerchantFeedData,
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [product()],
      },
      trustProfile: trustProfile(),
    });

    expect(result.totals.productsWithVerifiedImages).toBe(0);
    expect(
      result.checks.find((check) => check.id === 'verified-image-coverage')
    ).toMatchObject({
      affectedProductCount: 1,
      severity: 'fail',
    });
  });

  it('warns but does not fail when only policy details are missing', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: googleFeedData(),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [product()],
      },
      trustProfile: trustProfile({
        returnPolicy: undefined,
        shippingPolicy: undefined,
      }),
    });

    expect(result.status).toBe('warn');
    expect(
      result.checks.find((check) => check.id === 'policy-coverage')
    ).toMatchObject({ affectedProductCount: 1, severity: 'warn' });
    expect(
      result.checks.find((check) => check.id === 'support-contact')
    ).toMatchObject({ severity: 'pass' });
  });

  it('warns when only one policy is configured', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: googleFeedData(),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [product()],
      },
      trustProfile: trustProfile({
        shippingPolicy: undefined,
      }),
    });

    expect(result.status).toBe('warn');
    expect(
      result.checks.find((check) => check.id === 'policy-coverage')
    ).toMatchObject({ affectedProductCount: 1, severity: 'warn' });
  });

  it('does not count generated privacy and terms URLs as published policies', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: googleFeedData(),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [product()],
      },
      trustProfile: trustProfile({
        derivedLinks: {
          returns: 'https://ogabassey.com/returns',
          shipping: 'https://ogabassey.com/shipping',
        },
      }),
    });

    expect(result.status).toBe('warn');
    expect(
      result.checks.find((check) => check.id === 'policy-coverage')
    ).toMatchObject({
      affectedProductCount: 1,
      message:
        '2 of 4 policy links are published (returns, shipping, privacy, terms).',
      severity: 'warn',
    });
  });

  it('adds a dashboard next step for every trust check', () => {
    const result = buildAgentCommerceTrustReadiness({
      baseUrl: 'https://ogabassey.com',
      googleFeedData: googleFeedData(),
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      now: NOW,
      openAiFeedData: {
        products: [product()],
      },
      trustProfile: trustProfile(),
    });

    for (const check of result.checks) {
      expect(check.next_step).toEqual(expect.any(String));
      expect(check.next_step_url).toEqual(
        expect.stringMatching(/^\/dashboard\//)
      );
    }
  });
});
