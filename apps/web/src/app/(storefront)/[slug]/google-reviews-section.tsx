import { getPlaceDetailsServer } from '@/lib/google-places';

interface GoogleReviewsSectionProps {
  placeId: string;
  merchantName: string;
}

/**
 * Async Server Component for Google Places reviews.
 * Fetches external API data independently - streams when ready.
 * Only rendered for merchants with a configured Place ID.
 */
export async function GoogleReviewsSection({
  placeId,
  merchantName,
}: GoogleReviewsSectionProps) {
  try {
    const placeDetails = await getPlaceDetailsServer(placeId);

    if (!placeDetails) {
      return null;
    }

    return {
      rating: placeDetails.rating,
      reviewCount: placeDetails.userRatingCount || 0,
      reviews: placeDetails.reviews || [],
      merchantName,
    };
  } catch (error) {
    console.error('[GoogleReviewsSection] Failed to fetch:', error);
    return null;
  }
}

/**
 * Type for the resolved data from GoogleReviewsSection
 */
export type GoogleReviewsData = {
  rating: number;
  reviewCount: number;
  // biome-ignore lint/suspicious/noExplicitAny: Google Places API returns untyped review objects
  reviews: any[];
  merchantName: string;
} | null;
