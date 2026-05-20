import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_PLACE_REVIEW_FIELD_MASK,
  getCachedGooglePlacesReviews,
} from '@/lib/google-places-reviews';

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const mockFetch = vi.fn<typeof fetch>();

vi.stubGlobal('fetch', mockFetch);

describe('google-places-reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'browser-maps-key');
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'server-places-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fetches Places API review data with attribution and reporting fields', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          displayName: { text: 'Ogabassey' },
          rating: 4.8,
          userRatingCount: 217,
          googleMapsUri: 'https://maps.google.com/?cid=ogabassey',
          attributions: [
            {
              provider: 'Google Maps',
              providerUri: 'https://maps.google.com',
            },
          ],
          reviews: [
            {
              authorAttribution: {
                displayName: 'Ada',
                photoUri: 'https://lh3.googleusercontent.com/ada',
                uri: 'https://maps.google.com/contrib/ada',
              },
              flagContentUri:
                'https://www.google.com/local/reviews/report/ada-review',
              googleMapsUri: 'https://maps.google.com/?review=ada',
              publishTime: '2026-05-01T12:00:00Z',
              rating: 5,
              relativePublishTimeDescription: 'a month ago',
              text: { languageCode: 'en', text: 'Great service.' },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const result = await getCachedGooglePlacesReviews('ChIJ1234');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places/ChIJ1234',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Goog-Api-Key': 'server-places-key',
          'X-Goog-FieldMask': GOOGLE_PLACE_REVIEW_FIELD_MASK,
        }),
        signal: expect.any(AbortSignal),
      })
    );
    expect(result).toMatchObject({
      attributionLabel: 'Google Maps',
      businessName: 'Ogabassey',
      googleMapsUrl: 'https://maps.google.com/?cid=ogabassey',
      rating: 4.8,
      reviewsSortedBy: 'relevance',
      source: 'google_maps',
      totalReviews: 217,
      reviews: [
        {
          authorName: 'Ada',
          flagContentUri:
            'https://www.google.com/local/reviews/report/ada-review',
          googleMapsUri: 'https://maps.google.com/?review=ada',
          language: 'en',
          rating: 5,
          text: 'Great service.',
          timestamp: 1_777_636_800,
        },
      ],
    });
  });

  it('serializes missing review publish time as a numeric timestamp', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          reviews: [
            {
              authorAttribution: { displayName: 'Ada' },
              rating: 4,
              text: { text: 'Helpful staff.' },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const result = await getCachedGooglePlacesReviews('ChIJ1234');

    expect(result.reviews[0]).toMatchObject({
      authorName: 'Ada',
      rating: 4,
      text: 'Helpful staff.',
      timestamp: 0,
    });
  });

  it('rejects missing Google API key configuration before fetching', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');

    await expect(getCachedGooglePlacesReviews('ChIJ1234')).rejects.toThrow(
      'Google Places API key not configured'
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws a Google Places HTTP error for non-OK responses', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('upstream error', {
        status: 500,
      })
    );

    await expect(getCachedGooglePlacesReviews('ChIJ1234')).rejects.toThrow(
      'Google Places API error: 500'
    );
  });

  it('rejects invalid place IDs before fetching', async () => {
    await expect(
      getCachedGooglePlacesReviews('../../etc/passwd')
    ).rejects.toThrow('Invalid Google Place ID');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
