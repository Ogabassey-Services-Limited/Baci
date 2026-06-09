import { describe, expect, it, vi } from 'vitest';

describe('buildMerchantTrustProfile client bundle boundary', () => {
  it('does not require zod to normalize Google review authority for footer chrome', async () => {
    vi.resetModules();
    vi.doMock('zod', () => {
      throw new Error('zod should stay out of the footer trust profile bundle');
    });

    const { buildMerchantTrustProfile } = await import(
      './build-merchant-trust-profile'
    );

    const result = buildMerchantTrustProfile({
      feature_settings: {
        google_reviews_enabled: true,
        google_place_id: ' places/ChIJ1234 ',
      },
    });

    expect(result.merchantReviewAuthority?.placeId).toBe('ChIJ1234');
  });
});
