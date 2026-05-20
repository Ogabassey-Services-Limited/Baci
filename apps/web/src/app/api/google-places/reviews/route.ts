import { type NextRequest, NextResponse } from 'next/server';
import { googlePlaceIdSchema } from '@/lib/google-place-id';
import { getCachedGooglePlacesReviews } from '@/lib/google-places-reviews';

/**
 * Google Places API Reviews Route
 * Fetches reviews for a business using Google Places API.
 *
 * Note: Google Places API returns up to 5 relevant reviews.
 * This is a limitation of the API, not our implementation.
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/place-details
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryResult = googlePlaceIdSchema.safeParse(
      searchParams.get('placeId') ?? ''
    );

    if (!queryResult.success) {
      const message =
        queryResult.error.issues[0]?.message ?? 'Invalid Place ID format';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const reviewsData = await getCachedGooglePlacesReviews(queryResult.data);

    return NextResponse.json(reviewsData, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('Google Places API error:', error);

    const message =
      error instanceof Error ? error.message : 'Failed to fetch reviews';

    if (message.includes('API key')) {
      return NextResponse.json(
        { error: 'Google Reviews temporarily unavailable' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
