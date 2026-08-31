import { describe, expect, it } from 'vitest';
import { StorefrontPublicMerchantSchema } from './public-projection-merchant-schema';

const validMerchant = {
  country: 'NG',
  currency: 'NGN',
  hostname: 'pilot-store.usebaci.com',
  id: '123e4567-e89b-42d3-a456-426614174000',
  locale: 'en-NG',
  name: 'Pilot Store',
  publishedStatus: 'published',
  slug: 'pilot-store',
  template: { contractVersion: 'v1', id: 'ogabassey' },
} as const;

describe('StorefrontPublicMerchantSchema', () => {
  it('accepts canonical routing and localization fields', () => {
    expect(StorefrontPublicMerchantSchema.parse(validMerchant)).toEqual(
      validMerchant
    );
  });

  it('requires every routing and localization field', () => {
    for (const key of ['country', 'currency', 'hostname', 'locale'] as const) {
      const merchant = { ...validMerchant } as Record<string, unknown>;
      delete merchant[key];
      expect(StorefrontPublicMerchantSchema.safeParse(merchant).success).toBe(
        false
      );
    }
  });

  it('rejects noncanonical hostnames and localization values', () => {
    for (const merchant of [
      { ...validMerchant, hostname: 'Pilot-Store.usebaci.com' },
      { ...validMerchant, hostname: 'pilot-store.usebaci.com.' },
      { ...validMerchant, currency: 'ngn' },
      { ...validMerchant, country: 'ng' },
      { ...validMerchant, locale: 'EN-ng' },
    ])
      expect(StorefrontPublicMerchantSchema.safeParse(merchant).success).toBe(
        false
      );
  });

  it('rejects publication hostnames that resolve to local or private names', () => {
    for (const hostname of [
      'localhost',
      '10.0.0.1',
      'foo.internal',
      'router.home.arpa',
      'intranet',
      '2130706433',
    ])
      expect(
        StorefrontPublicMerchantSchema.safeParse({
          ...validMerchant,
          hostname,
        }).success
      ).toBe(false);
  });

  it('rejects unknown merchant fields', () => {
    expect(
      StorefrontPublicMerchantSchema.safeParse({
        ...validMerchant,
        internalNotes: 'private',
      }).success
    ).toBe(false);
  });

  it('rejects noncanonical social-link URLs', () => {
    for (const twitter of [
      '/contact',
      '#support',
      '//x.com/store',
      'http://x.com/store',
      'https://x.com/store?utm=1',
    ])
      expect(
        StorefrontPublicMerchantSchema.safeParse({
          ...validMerchant,
          socialLinks: { twitter },
        }).success
      ).toBe(false);
  });

  it('preserves bounded public browser analytics identifiers', () => {
    const merchant = {
      ...validMerchant,
      analytics: {
        facebookPixelId: '123456789012345',
        googleAnalyticsId: 'G-ABC123',
        snapchatPixelId: 'abc12345-6789-def0-1234-567890abcdef',
        tiktokPixelId: 'CTABC123',
        twitterPixelId: 'o1234',
        googleStoreWidget: {
          enabled: true,
          merchantCenterId: '112524323',
        },
      },
    };
    expect(StorefrontPublicMerchantSchema.parse(merchant)).toEqual(merchant);
  });

  it('rejects provider identifiers with the wrong provider format', () => {
    for (const analytics of [
      { googleAnalyticsId: 'UA-12345-1' },
      { facebookPixelId: '1234567890' },
      { tiktokPixelId: 'pixel-123' },
      { snapchatPixelId: 'snap-123' },
      { twitterPixelId: 'tw-123' },
    ])
      expect(
        StorefrontPublicMerchantSchema.safeParse({
          ...validMerchant,
          analytics,
        }).success
      ).toBe(false);
  });

  it('rejects malformed Google Store widget configuration', () => {
    expect(
      StorefrontPublicMerchantSchema.safeParse({
        ...validMerchant,
        analytics: {
          googleStoreWidget: {
            enabled: true,
            merchantCenterId: 'merchant-secret',
          },
        },
      }).success
    ).toBe(false);
  });

  it('requires a bounded versioned storefront template identity', () => {
    const merchant = { ...validMerchant } as Record<string, unknown>;
    delete merchant.template;
    expect(StorefrontPublicMerchantSchema.safeParse(merchant).success).toBe(
      false
    );
    expect(
      StorefrontPublicMerchantSchema.safeParse({
        ...validMerchant,
        template: { contractVersion: 'latest', id: 'Custom Theme' },
      }).success
    ).toBe(false);
  });
});
