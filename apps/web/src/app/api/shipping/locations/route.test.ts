import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mockTopshipProvider = vi.hoisted(() => ({
  getCities: vi.fn(),
  getStates: vi.fn(),
}));

vi.mock('@/lib/shipping/providers/topship', () => ({
  topshipProvider: mockTopshipProvider,
}));

const broadProviderCities = Array.from({ length: 300 }, (_, index) => ({
  name: index === 0 ? 'ABAK' : `CITY ${index}`,
}));

function createRequest(state: string) {
  return new NextRequest(
    `https://usebaci.com/api/shipping/locations?state=${encodeURIComponent(state)}`
  );
}

function createLocationsRequest(query = '') {
  return new NextRequest(`https://usebaci.com/api/shipping/locations${query}`);
}

describe('GET /api/shipping/locations', () => {
  beforeEach(() => {
    mockTopshipProvider.getStates.mockResolvedValue([
      { code: 'NG-FC', countryCode: 'NG', name: 'Abuja' },
      { code: 'NG-LA', countryCode: 'NG', name: 'Lagos' },
    ]);
    mockTopshipProvider.getCities.mockResolvedValue(broadProviderCities);
  });

  it('accepts FCT aliases when Topship labels the state as Abuja', async () => {
    const response = await GET(createRequest('Federal Capital Territory'));
    const payload = await response.json();

    expect(payload.locations).toEqual(
      expect.arrayContaining([
        { city: 'Garki', state: 'Abuja', stationName: 'Garki' },
        { city: 'Lugbe', state: 'Abuja', stationName: 'Lugbe' },
      ])
    );
    expect(payload.locations).not.toEqual(
      expect.arrayContaining([
        { city: 'ABAK', state: 'Abuja', stationName: 'ABAK' },
      ])
    );
  });

  it('falls back to Lagos-specific cities when provider returns all-country cities', async () => {
    const response = await GET(createRequest('Lagos'));
    const payload = await response.json();

    expect(payload.locations).toEqual(
      expect.arrayContaining([
        { city: 'Ikeja', state: 'Lagos', stationName: 'Ikeja' },
        { city: 'Lekki', state: 'Lagos', stationName: 'Lekki' },
      ])
    );
    expect(payload.locations).not.toEqual(
      expect.arrayContaining([
        { city: 'ABAK', state: 'Lagos', stationName: 'ABAK' },
      ])
    );
    expect(mockTopshipProvider.getCities).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid query parameters', async () => {
    const response = await GET(createLocationsRequest('?search=x'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'Invalid query parameters',
      details: expect.any(Object),
    });
  });
});
