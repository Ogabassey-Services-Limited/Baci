import { unstable_cache } from 'next/cache';
import { getGooglePlacesApiKey } from '@/env';
import { normalizeGooglePlaceId } from '@/lib/google-place-id';

const NEW_PLACES_API_BASE = 'https://places.googleapis.com/v1';
const GOOGLE_PLACES_REQUEST_TIMEOUT_MS = 5_000;

export const GOOGLE_PLACE_REVIEW_FIELD_MASK = [
  'displayName',
  'rating',
  'userRatingCount',
  'reviews',
  'googleMapsUri',
  'attributions',
].join(',');

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

export interface GooglePlaceAttribution {
  provider?: string;
  providerUri?: string;
}

export interface FormattedGooglePlaceReview {
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

export interface GooglePlacesReviewsResponse {
  attributionLabel: 'Google Maps';
  attributions: GooglePlaceAttribution[];
  reviews: FormattedGooglePlaceReview[];
  reviewsSortedBy: 'relevance';
  rating: number;
  source: 'google_maps';
  totalReviews: number;
  businessName?: string;
  googleMapsUrl?: string;
}

function toUnixSeconds(value?: string): number {
  if (!value) return 0;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

function formatGooglePlaceReview(
  review: GooglePlaceReview
): FormattedGooglePlaceReview {
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function fetchGooglePlaceDetails(
  placeId: string,
  apiKey: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    GOOGLE_PLACES_REQUEST_TIMEOUT_MS
  );

  try {
    return await fetch(
      `${NEW_PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': GOOGLE_PLACE_REVIEW_FIELD_MASK,
        },
        signal: controller.signal,
      }
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error('Google Places API request timed out');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const getCachedGooglePlacesReviews = unstable_cache(
  async (placeId: string): Promise<GooglePlacesReviewsResponse> => {
    const normalizedPlaceId = normalizeGooglePlaceId(placeId);

    if (!normalizedPlaceId) {
      throw new Error('Invalid Google Place ID');
    }

    const apiKey = getGooglePlacesApiKey();

    if (!apiKey) {
      throw new Error('Google Places API key not configured');
    }

    const response = await fetchGooglePlaceDetails(normalizedPlaceId, apiKey);

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
      reviews: (data.reviews || []).map(formatGooglePlaceReview),
      reviewsSortedBy: 'relevance',
      source: 'google_maps',
      totalReviews: data.userRatingCount || 0,
    };
  },
  ['google-places-reviews'],
  {
    revalidate: 3600,
    tags: ['google-reviews'],
  }
);
