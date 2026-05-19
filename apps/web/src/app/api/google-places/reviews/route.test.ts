import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const mockFetch = vi.fn<typeof fetch>();
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

vi.stubGlobal('fetch', mockFetch);

function makeRequest(placeId?: string) {
  const url = new URL('http://localhost:3000/api/google-places/reviews');
  if (placeId) {
    url.searchParams.set('placeId', placeId);
  }
  return new NextRequest(url);
}

function importRoute() {
  vi.resetModules();
  return import('./route');
}

describe('GET /api/google-places/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('fetches Google reviews through the current Places API with attribution fields', async () => {
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
                uri: 'https://maps.google.com/contrib/ada',
                photoUri: 'https://lh3.googleusercontent.com/ada',
              },
              rating: 5,
              relativePublishTimeDescription: 'a month ago',
              text: { text: 'Great service.', languageCode: 'en' },
              publishTime: '2026-05-01T12:00:00Z',
            },
          ],
        }),
        { status: 200 }
      )
    );
    const { GET } = await importRoute();

    const response = await GET(makeRequest('ChIJ1234'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places/ChIJ1234',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Goog-Api-Key': 'test-api-key',
          'X-Goog-FieldMask':
            'displayName,rating,userRatingCount,reviews,googleMapsUri,attributions',
        }),
        method: 'GET',
      })
    );
    expect(body).toMatchObject({
      attributionLabel: 'Google Maps',
      businessName: 'Ogabassey',
      googleMapsUrl: 'https://maps.google.com/?cid=ogabassey',
      rating: 4.8,
      reviewsSortedBy: 'relevance',
      source: 'google_maps',
      totalReviews: 217,
      attributions: [
        {
          provider: 'Google Maps',
          providerUri: 'https://maps.google.com',
        },
      ],
      reviews: [
        {
          authorName: 'Ada',
          authorPhoto: 'https://lh3.googleusercontent.com/ada',
          authorUrl: 'https://maps.google.com/contrib/ada',
          language: 'en',
          publishedAt: '2026-05-01T12:00:00Z',
          rating: 5,
          relativeTime: 'a month ago',
          text: 'Great service.',
          timestamp: 1_777_636_800,
        },
      ],
    });
  });

  it('accepts place resource names and normalizes them for the Places API URL', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ rating: 4.5, userRatingCount: 12 }), {
        status: 200,
      })
    );
    const { GET } = await importRoute();

    const response = await GET(makeRequest('places/ChIJ1234'));

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places/ChIJ1234',
      expect.any(Object)
    );
  });

  it('rejects malformed place IDs without calling Google', async () => {
    const { GET } = await importRoute();

    const response = await GET(makeRequest('../../etc/passwd'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid Place ID format' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('hides missing API key details from storefront callers', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    const { GET } = await importRoute();

    const response = await GET(makeRequest('ChIJ1234'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: 'Google Reviews temporarily unavailable' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
