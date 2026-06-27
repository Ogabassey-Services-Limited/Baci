import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseUrl,
  jsonResponse,
  loginResponseWithoutCustomerType,
  stationsResponse,
} from './gigl.test-helpers';

describe('GIGL station lookup', () => {
  beforeEach(() => {
    process.env.GIGL_BASE_URL = baseUrl;
    process.env.GIGL_EMAIL = 'test@example.com';
    process.env.GIGL_PASSWORD = 'test-password';
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.GIGL_BASE_URL;
    delete process.env.GIGL_EMAIL;
    delete process.env.GIGL_PASSWORD;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('maps GIGL stations into unified locations and reuses the station cache', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.getLocations()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          city: 'PORT HARCOURT',
          state: 'RIVERS',
          stationId: 30,
          stationName: 'PORT HARCOURT',
        }),
      ])
    );
    await expect(provider.getLocations()).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
