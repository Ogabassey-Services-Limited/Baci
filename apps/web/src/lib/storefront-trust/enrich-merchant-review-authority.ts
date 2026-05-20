import { getCachedGooglePlacesReviews } from '@/lib/google-places-reviews';
import { logger } from '@/lib/logger';
import type { MerchantTrustProfile } from '@/lib/storefront-trust/merchant-trust-profile-types';

export async function enrichMerchantReviewAuthority(
  trustProfile: MerchantTrustProfile
): Promise<MerchantTrustProfile> {
  const authority = trustProfile.merchantReviewAuthority;
  if (!authority) return trustProfile;
  if (typeof authority.placeId !== 'string') {
    return trustProfile;
  }

  const placeId = authority.placeId.trim();
  if (!placeId) return trustProfile;

  try {
    const reviewsData = await getCachedGooglePlacesReviews(placeId);

    return {
      ...trustProfile,
      merchantReviewAuthority: {
        ...authority,
        attributionLabel: reviewsData.attributionLabel,
        attributions: reviewsData.attributions,
        businessName: reviewsData.businessName,
        googleMapsUrl: reviewsData.googleMapsUrl,
        rating: reviewsData.rating,
        reviewsSortedBy: reviewsData.reviewsSortedBy,
        source: reviewsData.source,
        totalReviews: reviewsData.totalReviews,
      },
    };
  } catch (error) {
    logger.error({
      message: 'Merchant review authority enrichment failed',
      error,
      placeId,
    });
    return trustProfile;
  }
}
