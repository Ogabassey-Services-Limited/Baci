import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { GET } = await import('./route');

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/places/details');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe('GET /api/places/details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not crash when an address component is missing types', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'places/ChIJ1234',
        formattedAddress: '2 Olaide Tomori St, Ikeja, Lagos, Nigeria',
        addressComponents: [
          { longText: 'ignored-without-types' },
          { types: ['locality'], longText: 'Ikeja' },
          { types: ['country'], longText: 'Nigeria' },
        ],
        location: { latitude: 6.6, longitude: 3.3 },
      }),
    } as Response);

    const response = await GET(makeRequest({ placeId: 'places/ChIJ1234' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      details: expect.objectContaining({
        placeId: 'places/ChIJ1234',
        city: 'Ikeja',
        country: 'Nigeria',
        streetNumber: '',
      }),
    });
  });

  it('returns 400 for malformed placeId', async () => {
    const response = await GET(makeRequest({ placeId: '../../etc/passwd' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid placeId format' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
