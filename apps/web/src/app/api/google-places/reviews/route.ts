import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Google Places API Reviews Route
 * Fetches reviews for a business using Google Places API
 *
 * Note: Google Places API returns up to 5 relevant reviews.
 * This is a limitation of the API, not our implementation.
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/place-details
 */

const NEW_PLACES_API_BASE = 'https://places.googleapis.com/v1';
const PLACE_REVIEW_FIELD_MASK = [
  'displayName',
  'rating',
  'userRatingCount',
  'reviews',
  'googleMapsUri',
  'attributions',
].join(',');
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const reviewsQuerySchema = z.object({
  placeId: z
    .string()
    .trim()
    .min(1, 'Place ID is required')
    .transform((value) =>
      value.startsWith('places/') ? value.slice('places/'.length) : value
    )
    .refine((value) => PLACE_ID_PATTERN.test(value), {
      message: 'Invalid Place ID format',
    }),
});

interface GooglePlaceLocalizedText {
  languageCode?: string;
  text?: string;
}

interface GooglePlaceAuthorAttribution {
  displayName?: string;
  photoUri?: string;
  uri?: string;
}

interface GooglePlaceReview {
  authorAttribution?: GooglePlaceAuthorAttribution;
  name?: string;
  originalText?: GooglePlaceLocalizedText;
  publishTime?: string;
  rating?: number;
  relativePublishTimeDescription?: string;
  text?: GooglePlaceLocalizedText;
  flagContentUri?: string;
  googleMapsUri?: string;
}

interface GooglePlaceDetails {
  attributions?: GooglePlaceAttribution[];
  displayName?: GooglePlaceLocalizedText;
  googleMapsUri?: string;
  rating?: number;
  reviews?: GooglePlaceReview[];
  userRatingCount?: number;
}

interface GooglePlaceAttribution {
  provider?: string;
  providerUri?: string;
}

interface FormattedReview {
  authorName: string;
  authorUrl?: string;
  authorPhoto?: string;
  language?: string;
  publishedAt?: string;
  rating: number;
  text: string;
  relativeTime: string;
  timestamp: number;
  flagContentUri?: string;
  googleMapsUri?: string;
}

interface ReviewsResponse {
  attributionLabel: 'Google Maps';
  attributions: GooglePlaceAttribution[];
  reviews: FormattedReview[];
  reviewsSortedBy: 'relevance';
  rating: number;
  source: 'google_maps';
  totalReviews: number;
  businessName?: string;
  googleMapsUrl?: string;
}

function getGooglePlacesApiKey(): string | undefined {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
}

function toUnixSeconds(value?: string): number {
  if (!value) return 0;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

function formatReview(review: GooglePlaceReview): FormattedReview {
  const authorAttribution = review.authorAttribution;
  const text = review.text?.text ?? review.originalText?.text ?? '';

  return {
    authorName: authorAttribution?.displayName || 'Google Maps user',
    authorUrl: authorAttribution?.uri,
    authorPhoto: authorAttribution?.photoUri,
    language: review.text?.languageCode ?? review.originalText?.languageCode,
    publishedAt: review.publishTime,
    rating: review.rating ?? 0,
    text,
    relativeTime: review.relativePublishTimeDescription || '',
    timestamp: toUnixSeconds(review.publishTime),
    flagContentUri: review.flagContentUri,
    googleMapsUri: review.googleMapsUri,
  };
}

// Cache reviews for 1 hour to reduce API calls
const getCachedReviews = unstable_cache(
  async (placeId: string): Promise<ReviewsResponse> => {
    const apiKey = getGooglePlacesApiKey();

    if (!apiKey) {
      throw new Error('Google Places API key not configured');
    }

    const url = `${NEW_PLACES_API_BASE}/places/${placeId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACE_REVIEW_FIELD_MASK,
      },
    });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data: GooglePlaceDetails = await response.json();

    return {
      attributionLabel: 'Google Maps',
      attributions: data.attributions ?? [],
      businessName: data.displayName?.text,
      googleMapsUrl: data.googleMapsUri,
      rating: data.rating || 0,
      reviews: (data.reviews || []).map(formatReview),
      reviewsSortedBy: 'relevance',
      source: 'google_maps',
      totalReviews: data.userRatingCount || 0,
    };
  },
  ['google-places-reviews'],
  {
    revalidate: 3600, // 1 hour cache
    tags: ['google-reviews'],
  }
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryResult = reviewsQuerySchema.safeParse({
      placeId: searchParams.get('placeId') ?? '',
    });

    if (!queryResult.success) {
      const message =
        queryResult.error.issues[0]?.message ?? 'Invalid Place ID format';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const reviewsData = await getCachedReviews(queryResult.data.placeId);

    return NextResponse.json(reviewsData, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('Google Places API error:', error);

    const message =
      error instanceof Error ? error.message : 'Failed to fetch reviews';

    // Don't expose API key errors to client
    if (message.includes('API key')) {
      return NextResponse.json(
        { error: 'Google Reviews temporarily unavailable' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
