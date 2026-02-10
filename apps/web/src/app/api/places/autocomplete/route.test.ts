import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Set environment variable BEFORE importing the route
vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import the handler AFTER mocks
const { GET } = await import('./route');

// Helper function to create test requests
function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/places/autocomplete');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

// Helper to create mock Google API response
function createGoogleResponse(
  suggestions: Array<{
    placeId: string;
    mainText: string;
    secondaryText?: string;
    fullText: string;
  }>
) {
  return {
    suggestions: suggestions.map((s) => ({
      placePrediction: {
        placeId: s.placeId,
        structuredFormat: {
          mainText: { text: s.mainText },
          secondaryText: { text: s.secondaryText || '' },
        },
        text: { text: s.fullText },
      },
    })),
  };
}

describe('GET /api/places/autocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty predictions when input is too short (< 2 chars)', async () => {
    const request = makeRequest({ input: 'a' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ predictions: [] });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty predictions when input is empty string', async () => {
    const request = makeRequest({ input: '' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ predictions: [] });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns predictions for valid input', async () => {
    const mockGoogleData = createGoogleResponse([
      {
        placeId: 'ChIJ1234',
        mainText: 'Lagos',
        secondaryText: 'Nigeria',
        fullText: 'Lagos, Nigeria',
      },
      {
        placeId: 'ChIJ5678',
        mainText: 'Lekki',
        secondaryText: 'Lagos, Nigeria',
        fullText: 'Lekki, Lagos, Nigeria',
      },
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGoogleData,
      text: async () => JSON.stringify(mockGoogleData),
    } as Response);

    const request = makeRequest({ input: 'Lagos' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.predictions).toHaveLength(2);
    expect(data.predictions[0]).toEqual({
      placeId: 'ChIJ1234',
      mainText: 'Lagos',
      secondaryText: 'Nigeria',
      fullText: 'Lagos, Nigeria',
      description: 'Lagos, Nigeria',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:autocomplete',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': 'test-api-key',
        },
        body: JSON.stringify({ input: 'Lagos' }),
      })
    );
  });

  it('includes sessionToken in request body when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestions: [] }),
      text: async () => '{"suggestions":[]}',
    } as Response);

    const request = makeRequest({
      input: 'test',
      sessionToken: 'session-123',
    });

    await GET(request);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:autocomplete',
      expect.objectContaining({
        body: JSON.stringify({
          input: 'test',
          sessionToken: 'session-123',
        }),
      })
    );
  });

  it('includes country restriction when country param is provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestions: [] }),
      text: async () => '{"suggestions":[]}',
    } as Response);

    const request = makeRequest({
      input: 'Lagos',
      country: 'ng',
    });

    await GET(request);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:autocomplete',
      expect.objectContaining({
        body: JSON.stringify({
          input: 'Lagos',
          includedRegionCodes: ['NG'],
        }),
      })
    );
  });

  it('filters out non-placePrediction suggestions', async () => {
    const mixedResponse = {
      suggestions: [
        {
          placePrediction: {
            placeId: 'ChIJ1234',
            structuredFormat: {
              mainText: { text: 'Valid Place' },
              secondaryText: { text: 'Nigeria' },
            },
            text: { text: 'Valid Place, Nigeria' },
          },
        },
        {
          // Missing placePrediction - should be filtered out
          otherType: { data: 'something' },
        },
        {
          placePrediction: {
            placeId: 'ChIJ5678',
            structuredFormat: {
              mainText: { text: 'Another Valid' },
              secondaryText: { text: 'Lagos' },
            },
            text: { text: 'Another Valid, Lagos' },
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mixedResponse,
      text: async () => JSON.stringify(mixedResponse),
    } as Response);

    const request = makeRequest({ input: 'test' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.predictions).toHaveLength(2);
    expect(data.predictions[0].placeId).toBe('ChIJ1234');
    expect(data.predictions[1].placeId).toBe('ChIJ5678');
  });

  it('returns error status when Google API returns non-ok response', async () => {
    const errorText = 'Invalid API key';

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => errorText,
    } as Response);

    const request = makeRequest({ input: 'Lagos' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({
      error: 'Failed to fetch predictions',
      details: errorText,
    });
  });

  it('returns error when Google API returns 400 bad request', async () => {
    const errorText = 'Bad request: invalid input';

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => errorText,
    } as Response);

    const request = makeRequest({ input: 'test123' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      error: 'Failed to fetch predictions',
      details: errorText,
    });
  });

  it('returns 500 on network/fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const request = makeRequest({ input: 'Lagos' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });

  it('retries on ECONNRESET error and eventually returns 500', async () => {
    const econnResetError = new Error('fetch failed: ECONNRESET');

    // Will retry twice (total 3 attempts)
    mockFetch
      .mockRejectedValueOnce(econnResetError)
      .mockRejectedValueOnce(econnResetError)
      .mockRejectedValueOnce(econnResetError);

    const request = makeRequest({ input: 'Lagos' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
    expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('succeeds after retry on transient error', async () => {
    const mockGoogleData = createGoogleResponse([
      {
        placeId: 'ChIJ1234',
        mainText: 'Lagos',
        secondaryText: 'Nigeria',
        fullText: 'Lagos, Nigeria',
      },
    ]);

    mockFetch
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockGoogleData,
        text: async () => JSON.stringify(mockGoogleData),
      } as Response);

    const request = makeRequest({ input: 'Lagos' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.predictions).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });

  it('handles missing structuredFormat by falling back to text.text', async () => {
    const responseWithoutStructuredFormat = {
      suggestions: [
        {
          placePrediction: {
            placeId: 'ChIJ1234',
            text: { text: 'Full Text Only' },
            // No structuredFormat
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => responseWithoutStructuredFormat,
      text: async () => JSON.stringify(responseWithoutStructuredFormat),
    } as Response);

    const request = makeRequest({ input: 'test' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.predictions[0]).toEqual({
      placeId: 'ChIJ1234',
      mainText: 'Full Text Only',
      secondaryText: '',
      fullText: 'Full Text Only',
      description: 'Full Text Only',
    });
  });

  it('handles empty suggestions array from Google API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestions: [] }),
      text: async () => '{"suggestions":[]}',
    } as Response);

    const request = makeRequest({ input: 'xyz123notfound' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.predictions).toEqual([]);
  });

  it('handles missing suggestions field in Google API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
      text: async () => '{}',
    } as Response);

    const request = makeRequest({ input: 'test' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.predictions).toEqual([]);
  });
});
