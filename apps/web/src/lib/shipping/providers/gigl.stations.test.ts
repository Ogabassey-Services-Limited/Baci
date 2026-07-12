import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseUrl,
  failedStationsEnvelope,
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
    delete process.env.GIGL_STATIONS_TIMEOUT_MS;
    vi.useRealTimers();
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
    await expect(provider.getLocations('GH')).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent station fetches while the cache is cold', async () => {
    let resolveStations: (response: Response) => void = () => undefined;
    const stationsPromise = new Promise<Response>((resolve) => {
      resolveStations = resolve;
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockReturnValueOnce(stationsPromise);

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();
    const firstLocations = provider.getLocations();
    const secondLocations = provider.getLocations();

    resolveStations(jsonResponse(stationsResponse));

    await expect(
      Promise.all([firstLocations, secondLocations])
    ).resolves.toEqual([
      expect.arrayContaining([expect.objectContaining({ stationId: 30 })]),
      expect.arrayContaining([expect.objectContaining({ stationId: 30 })]),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not let one aborted caller cancel a shared station cache fill', async () => {
    let resolveStations: (response: Response) => void = () => undefined;
    const stationsPromise = new Promise<Response>((resolve) => {
      resolveStations = resolve;
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockReturnValueOnce(stationsPromise);

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();
    const controller = new AbortController();
    const abortedStations = provider.getStations(5000, controller.signal);
    const abortedAssertion = expect(abortedStations).rejects.toThrow();
    const waitingStations = provider.getStations();

    controller.abort();
    await abortedAssertion;
    resolveStations(jsonResponse(stationsResponse));

    await expect(waitingStations).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('upgrades the shared station cache fill to a longer caller timeout without sharing its abort signal', async () => {
    let resolveShortStations: (response: Response) => void = () => undefined;
    const shortStationsResponse = new Promise<Response>((resolve) => {
      resolveShortStations = resolve;
    });
    const stationFetchOptions: Array<RequestInit & { timeout?: number }> = [];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockImplementationOnce((_url, init) => {
        stationFetchOptions.push(init as RequestInit & { timeout?: number });
        return shortStationsResponse;
      })
      .mockImplementationOnce((_url, init) => {
        stationFetchOptions.push(init as RequestInit & { timeout?: number });
        return jsonResponse(stationsResponse);
      });

    const { GiglApiClient } = await import('./gigl.auth');
    const { GiglStationsService } = await import('./gigl.stations');
    const safeFetch = (
      url: string,
      options?: RequestInit & { timeout?: number }
    ) => fetch(url, options);
    const provider = new GiglStationsService(
      new GiglApiClient({ safeFetch, log: vi.fn() })
    );
    const controller = new AbortController();
    const shortStations = provider.getStations(5000);
    const longStations = provider.getStations(10_000, controller.signal);

    await expect(longStations).resolves.toHaveLength(2);
    resolveShortStations(jsonResponse(stationsResponse));
    await expect(shortStations).resolves.toHaveLength(2);
    expect(stationFetchOptions.map((options) => options.timeout)).toEqual([
      5000, 10_000,
    ]);
    expect(stationFetchOptions.map((options) => options.signal)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('times out cold station fetches without waiting for the provider default', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockReturnValueOnce(new Promise<Response>(() => undefined));

    const { GIGL_STATIONS_TIMEOUT_MS } = await import('./gigl.constants');
    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();
    const locationsPromise = provider.getLocations();
    const locationsAssertion = expect(locationsPromise).rejects.toThrow(
      'GIGL stations request timed out'
    );

    await vi.advanceTimersByTimeAsync(GIGL_STATIONS_TIMEOUT_MS);

    await locationsAssertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache an empty station response as valid locations', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            message: 'Success',
            status: 200,
            data: [],
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse(stationsResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.getLocations()).rejects.toThrow(
      'GIGL returned empty station list'
    );
    await expect(provider.getLocations()).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects failed station envelopes without poisoning the success path', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(failedStationsEnvelope))
      .mockResolvedValueOnce(jsonResponse(stationsResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.getLocations()).rejects.toThrow(
      'Invalid GIGL stations response'
    );
    await expect(provider.getLocations()).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('uses the synced nearest centre for ambiguous border locations', async () => {
    const { GiglStationsService } = await import('./gigl.stations');
    const service = new GiglStationsService(
      {} as never,
      vi.fn().mockResolvedValue({
        stationId: 4,
        serviceCentres: [
          {
            StationId: 4,
            StationName: 'LAGOS',
            ServiceCentreId: 65,
            ServiceCentreName: 'SANGO OTTA',
            Latitude: 6.707,
            Longitude: 3.243,
          },
        ],
      })
    );
    vi.spyOn(service, 'getStations').mockResolvedValue([
      {
        StationId: 2,
        StationName: 'ABEOKUTA',
        StateName: 'OGUN',
        StationCode: undefined,
        State: undefined,
        City: undefined,
        Address: undefined,
        Latitude: undefined,
        Longitude: undefined,
      },
      {
        StationId: 4,
        StationName: 'LAGOS',
        StateName: 'LAGOS',
        StationCode: undefined,
        State: undefined,
        City: undefined,
        Address: undefined,
        Latitude: undefined,
        Longitude: undefined,
      },
    ]);

    await expect(
      service.resolveStationForLocation({
        city: 'Alagbado',
        state: 'Ogun State',
        latitude: 6.68,
        longitude: 3.27,
      })
    ).resolves.toEqual({
      station: expect.objectContaining({ StationId: 4 }),
      serviceCentres: [expect.objectContaining({ ServiceCentreId: 65 })],
    });
  });

  it('normalizes state suffixes when coordinates are unavailable', async () => {
    const { GiglStationsService } = await import('./gigl.stations');
    const service = new GiglStationsService({} as never);
    vi.spyOn(service, 'getStations').mockResolvedValue([
      {
        StationId: 2,
        StationName: 'ABEOKUTA',
        StateName: 'OGUN',
        StationCode: undefined,
        State: undefined,
        City: undefined,
        Address: undefined,
        Latitude: undefined,
        Longitude: undefined,
      },
    ]);

    await expect(
      service.resolveStationForLocation({
        city: 'Alagbado',
        state: 'Ogun State',
      })
    ).resolves.toEqual({
      station: expect.objectContaining({ StationId: 2 }),
    });
  });
});
