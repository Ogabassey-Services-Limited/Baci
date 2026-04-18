import { describe, expect, it } from 'vitest';
import type { MerchantData } from '@/hooks/merchant';
import { buildGoogleMerchantReadiness } from './build-google-merchant-readiness';
import type { MerchantTrustProfile } from './merchant-trust-profile-types';

function buildMerchant(overrides: Partial<MerchantData> = {}): MerchantData {
  return {
    id: 'merchant-1',
    user_id: 'user-1',
    business_name: 'Ogabassey',
    business_type: 'electronics',
    slug: 'ogabassey',
    ...overrides,
  };
}

function buildTrustProfile(
  overrides: Partial<MerchantTrustProfile> = {}
): MerchantTrustProfile {
  return {
    socialLinks: {},
    derivedLinks: {},
    ...overrides,
  };
}

function buildFeedData(
  overrides: Partial<{
    products: Array<{
      id: string;
      brand?: string;
      gtin?: string;
      mpn?: string;
      google_product_category?: string;
    }>;
    imageManifest: Record<string, unknown[]>;
  }> = {}
) {
  return {
    products: [
      {
        id: 'product-1',
        brand: 'Samsung',
        gtin: '0123456789012',
        google_product_category: 'Electronics > Phones',
      },
    ],
    imageManifest: {
      'product-1': [
        {
          verified_url: 'https://cdn.example.com/products/phone.jpg',
          verified_format: 'jpeg',
          status: 'verified',
          is_primary: true,
          position: 0,
        },
      ],
    },
    ...overrides,
  };
}

describe('buildGoogleMerchantReadiness', () => {
  it('returns fail when no support contact exists', () => {
    const result = buildGoogleMerchantReadiness({
      merchant: buildMerchant(),
      trustProfile: buildTrustProfile(),
      feedData: buildFeedData(),
    });

    expect(
      result.checks.find((check) => check.id === 'support-contact')
    ).toMatchObject({
      severity: 'fail',
    });
  });

  it('returns warn when identifier coverage is zero but brand and image coverage are present', () => {
    const result = buildGoogleMerchantReadiness({
      merchant: buildMerchant({ support_email: 'support@ogabassey.com' }),
      trustProfile: buildTrustProfile({
        supportEmail: 'support@ogabassey.com',
      }),
      feedData: buildFeedData({
        products: [
          {
            id: 'product-1',
            brand: 'Samsung',
            google_product_category: 'Electronics > Phones',
          },
        ],
      }),
    });

    expect(result.totals).toMatchObject({
      products: 1,
      withBrand: 1,
      withIdentifier: 0,
      withVerifiedImage: 1,
    });
    expect(
      result.checks.find((check) => check.id === 'identifier-coverage')
    ).toMatchObject({
      severity: 'warn',
    });
  });

  it('returns fail when support contact fields are whitespace only', () => {
    const result = buildGoogleMerchantReadiness({
      merchant: buildMerchant({
        support_email: '   ',
        support_phone: '\n',
      }),
      trustProfile: buildTrustProfile(),
      feedData: buildFeedData(),
    });

    expect(
      result.checks.find((check) => check.id === 'support-contact')
    ).toMatchObject({
      severity: 'fail',
    });
  });

  it('returns warn when google_product_category coverage is partial', () => {
    const result = buildGoogleMerchantReadiness({
      merchant: buildMerchant({ support_email: 'support@ogabassey.com' }),
      trustProfile: buildTrustProfile({
        supportEmail: 'support@ogabassey.com',
      }),
      feedData: buildFeedData({
        products: [
          {
            id: 'product-1',
            brand: 'Samsung',
            gtin: '0123456789012',
            google_product_category: 'Electronics > Phones',
          },
          {
            id: 'product-2',
            brand: 'Samsung',
            gtin: '0123456789013',
          },
        ],
        imageManifest: {
          'product-1': [
            {
              verified_url: 'https://cdn.example.com/products/phone.jpg',
              verified_format: 'jpeg',
              status: 'verified',
              is_primary: true,
              position: 0,
            },
          ],
          'product-2': [
            {
              verified_url: 'https://cdn.example.com/products/phone-2.jpg',
              verified_format: 'jpeg',
              status: 'verified',
              is_primary: true,
              position: 0,
            },
          ],
        },
      }),
    });

    expect(
      result.checks.find((check) => check.id === 'google-category-coverage')
    ).toMatchObject({
      severity: 'warn',
    });
  });

  it('returns pass when return and shipping policy plus support basics are present', () => {
    const result = buildGoogleMerchantReadiness({
      merchant: buildMerchant({
        support_email: 'support@ogabassey.com',
      }),
      trustProfile: buildTrustProfile({
        supportEmail: 'support@ogabassey.com',
        returnPolicy: {
          summary: '30-day returns.',
          windowDays: 30,
          localRoute: '/returns',
        },
        shippingPolicy: {
          summary: 'Nationwide shipping.',
          regions: ['NG'],
          localRoute: '/shipping',
        },
      }),
      feedData: buildFeedData(),
    });

    expect(
      result.checks.find((check) => check.id === 'support-contact')
    ).toMatchObject({
      severity: 'pass',
    });
    expect(
      result.checks.find((check) => check.id === 'return-policy')
    ).toMatchObject({
      severity: 'pass',
    });
    expect(
      result.checks.find((check) => check.id === 'shipping-policy')
    ).toMatchObject({
      severity: 'pass',
    });
  });
});
