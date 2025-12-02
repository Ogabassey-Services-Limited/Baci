import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Google Places API Reviews Route
 * Fetches reviews for a business using Google Places API
 *
 * Note: Google Places API returns max 5 "most relevant" reviews
 * This is a limitation of the API, not our implementation
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/details
 */

interface GooglePlaceReview {
  author_name: string;
  author_url?: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
  language?: string;
}

interface GooglePlaceDetails {
  result: {
    name?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: GooglePlaceReview[];
    url?: string;
  };
  status: string;
  error_message?: string;
}

interface FormattedReview {
  authorName: string;
  authorUrl?: string;
  authorPhoto?: string;
  rating: number;
  text: string;
  relativeTime: string;
  timestamp: number;
}

interface ReviewsResponse {
  reviews: FormattedReview[];
  rating: number;
  totalReviews: number;
  businessName?: string;
  googleMapsUrl?: string;
}

// Cache reviews for 1 hour to reduce API calls
const getCachedReviews = unstable_cache(
  async (placeId: string): Promise<ReviewsResponse> => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      throw new Error('Google Places API key not configured');
    }

    const url = new URL(
      'https://maps.googleapis.com/maps/api/place/details/json'
    );
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', apiKey);
    url.searchParams.set(
      'fields',
      'name,rating,user_ratings_total,reviews,url'
    );
    url.searchParams.set('reviews_sort', 'newest'); // Get newest reviews

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data: GooglePlaceDetails = await response.json();

    if (data.status !== 'OK') {
      throw new Error(
        data.error_message || `Google Places API status: ${data.status}`
      );
    }

    const result = data.result;

    // Format reviews for our frontend
    const reviews: FormattedReview[] = (result.reviews || []).map((review) => ({
      authorName: review.author_name,
      authorUrl: review.author_url,
      authorPhoto: review.profile_photo_url,
      rating: review.rating,
      text: review.text,
      relativeTime: review.relative_time_description,
      timestamp: review.time,
    }));

    return {
      reviews,
      rating: result.rating || 0,
      totalReviews: result.user_ratings_total || 0,
      businessName: result.name,
      googleMapsUrl: result.url,
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
    const placeId = searchParams.get('placeId');

    if (!placeId) {
      return NextResponse.json(
        { error: 'Place ID is required' },
        { status: 400 }
      );
    }

    // Validate Place ID format (starts with ChIJ)
    if (!placeId.startsWith('ChIJ') && !placeId.startsWith('Eh')) {
      return NextResponse.json(
        { error: 'Invalid Place ID format' },
        { status: 400 }
      );
    }

    const reviewsData = await getCachedReviews(placeId);

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
