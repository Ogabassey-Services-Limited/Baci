import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GIGL_BASE_URL =
    'https://dev-thirdpartynode.theagilitysystems.com';
  process.env.GIGL_EMAIL = 'test@example.com';
  process.env.GIGL_PASSWORD = 'test-password';
});

import { GiglApiClient } from './gigl.auth';
import { GiglStationsService } from './gigl.stations';
import {
  baseUrl,
  jsonResponse,
  loginResponseWithoutCustomerType,
  serviceCentresResponse,
} from './gigl.test-helpers';

describe('GIGL service centre lookup', () => {
  beforeEach(() => {
    process.env.GIGL_BASE_URL = baseUrl;
    process.env.GIGL_EMAIL = 'test@example.com';
    process.env.GIGL_PASSWORD = 'test-password';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches service centres for a station and reuses the station-scoped cache', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(serviceCentresResponse));
    vi.stubGlobal('fetch', fetchMock);
    const safeFetch = (url: string, options?: RequestInit) =>
      fetch(url, options);
    const service = new GiglStationsService(
      new GiglApiClient({ safeFetch, log: vi.fn() })
    );

    await expect(service.getServiceCentres(30)).resolves.toHaveLength(4);
    await expect(service.getServiceCentres(30)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ServiceCentreCode: 'RUM',
          ServiceCentreId: 575,
        }),
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `${baseUrl}/serviceCentresByStation?StationId=30`
    );
  });

  it('finds a selected service centre and returns null for an unknown id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(serviceCentresResponse));
    vi.stubGlobal('fetch', fetchMock);
    const safeFetch = (url: string, options?: RequestInit) =>
      fetch(url, options);
    const service = new GiglStationsService(
      new GiglApiClient({ safeFetch, log: vi.fn() })
    );

    await expect(service.findServiceCentreById(30, 575)).resolves.toMatchObject(
      {
        ServiceCentreCode: 'RUM',
        ServiceCentreId: 575,
      }
    );
    await expect(service.findServiceCentreById(30, 9999)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent service-centre requests for the same station', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(serviceCentresResponse));
    vi.stubGlobal('fetch', fetchMock);
    const safeFetch = (url: string, options?: RequestInit) =>
      fetch(url, options);
    const service = new GiglStationsService(
      new GiglApiClient({ safeFetch, log: vi.fn() })
    );

    const [first, second] = await Promise.all([
      service.getServiceCentres(30),
      service.getServiceCentres(30),
    ]);

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a non-successful service-centre response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const safeFetch = (url: string, options?: RequestInit) =>
      fetch(url, options);
    const service = new GiglStationsService(
      new GiglApiClient({ safeFetch, log: vi.fn() })
    );

    await expect(service.getServiceCentres(30)).rejects.toThrow(
      'Failed to fetch GIGL service centres for station 30'
    );
  });

  it('rejects an unsuccessful service-centre envelope', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(
        jsonResponse({
          success: false,
          data: { data: null, message: 'Provider unavailable', status: 500 },
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    const safeFetch = (url: string, options?: RequestInit) =>
      fetch(url, options);
    const service = new GiglStationsService(
      new GiglApiClient({ safeFetch, log: vi.fn() })
    );

    await expect(service.getServiceCentres(30)).rejects.toThrow(
      'Invalid GIGL service centres response for station 30'
    );
  });

  it('caches a valid empty service-centre list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { data: [], message: 'Success', status: 200 },
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    const safeFetch = (url: string, options?: RequestInit) =>
      fetch(url, options);
    const service = new GiglStationsService(
      new GiglApiClient({ safeFetch, log: vi.fn() })
    );

    await expect(service.getServiceCentres(30)).resolves.toEqual([]);
    await expect(service.getServiceCentres(30)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
