import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrichMerchantReviewAuthority } from './enrich-merchant-review-authority';
import type { MerchantTrustProfile } from './merchant-trust-profile-types';

const { getCachedGooglePlacesReviews, loggerError } = vi.hoisted(() => ({
  getCachedGooglePlacesReviews: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/google-places-reviews', () => ({
  getCachedGooglePlacesReviews: (...args: unknown[]) =>
    getCachedGooglePlacesReviews(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
  },
}));

function trustProfile(
  overrides: Partial<MerchantTrustProfile> = {}
): MerchantTrustProfile {
  return {
    derivedLinks: {},
    socialLinks: {},
    ...overrides,
  };
}

describe('enrichMerchantReviewAuthority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedGooglePlacesReviews.mockResolvedValue({
      attributionLabel: 'Google Maps',
      attributions: [
        {
          provider: 'Google Maps',
          providerUri: 'https://maps.google.com',
        },
      ],
      businessName: 'Ogabassey',
      googleMapsUrl: 'https://maps.google.com/?cid=ogabassey',
      rating: 4.8,
      reviews: [],
      reviewsSortedBy: 'relevance',
      source: 'google_maps',
      totalReviews: 217,
    });
  });

  it('skips Google Places lookup when no merchant review authority is configured', async () => {
    const profile = trustProfile();

    const result = await enrichMerchantReviewAuthority(profile);

    expect(result).toBe(profile);
    expect(getCachedGooglePlacesReviews).not.toHaveBeenCalled();
  });

  it('skips Google Places lookup when merchant review authority has no Place ID', async () => {
    const profile = trustProfile({
      merchantReviewAuthority: {
        attributionLabel: 'Google Maps',
        reviewsSortedBy: 'relevance',
        source: 'google_maps',
      } as MerchantTrustProfile['merchantReviewAuthority'],
    });

    const result = await enrichMerchantReviewAuthority(profile);

    expect(result).toBe(profile);
    expect(getCachedGooglePlacesReviews).not.toHaveBeenCalled();
  });

  it('enriches configured Google review authority with Places rating metadata', async () => {
    const result = await enrichMerchantReviewAuthority(
      trustProfile({
        merchantReviewAuthority: {
          attributionLabel: 'Google Maps',
          placeId: 'ChIJ1234',
          reviewsSortedBy: 'relevance',
          source: 'google_maps',
        },
      })
    );

    expect(getCachedGooglePlacesReviews).toHaveBeenCalledWith('ChIJ1234');
    expect(result.merchantReviewAuthority).toMatchObject({
      attributions: [
        {
          provider: 'Google Maps',
          providerUri: 'https://maps.google.com',
        },
      ],
      businessName: 'Ogabassey',
      googleMapsUrl: 'https://maps.google.com/?cid=ogabassey',
      placeId: 'ChIJ1234',
      rating: 4.8,
      totalReviews: 217,
    });
  });

  it('trims configured Google Place IDs before lookup and logging', async () => {
    const profile = trustProfile({
      merchantReviewAuthority: {
        attributionLabel: 'Google Maps',
        placeId: '  ChIJ1234  ',
        reviewsSortedBy: 'relevance',
        source: 'google_maps',
      },
    });

    getCachedGooglePlacesReviews.mockRejectedValueOnce(
      new Error('Google Places API error: 404')
    );

    const result = await enrichMerchantReviewAuthority(profile);

    expect(result).toBe(profile);
    expect(getCachedGooglePlacesReviews).toHaveBeenCalledWith('ChIJ1234');
    expect(loggerError).toHaveBeenCalledWith({
      message: 'Merchant review authority enrichment failed',
      error: expect.any(Error),
      placeId: 'ChIJ1234',
    });
  });

  it('keeps configured authority when Google Places enrichment fails', async () => {
    const profile = trustProfile({
      merchantReviewAuthority: {
        attributionLabel: 'Google Maps',
        placeId: 'ChIJ1234',
        reviewsSortedBy: 'relevance',
        source: 'google_maps',
      },
    });
    getCachedGooglePlacesReviews.mockRejectedValueOnce(
      new Error('Google Places API error: 403')
    );

    const result = await enrichMerchantReviewAuthority(profile);

    expect(result).toBe(profile);
    expect(loggerError).toHaveBeenCalledWith({
      message: 'Merchant review authority enrichment failed',
      error: expect.any(Error),
      placeId: 'ChIJ1234',
    });
  });
});
