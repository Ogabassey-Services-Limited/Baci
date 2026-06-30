import type { UnifiedLocation } from '../types';
import type { GiglApiClient } from './gigl.auth';
import {
  GIGL_STATIONS_CACHE_TTL_MS,
  GIGL_STATIONS_TIMEOUT_MS,
  withGiglRequestTimeout,
} from './gigl.constants';
import type { GiglStation } from './gigl.schemas';
import { giglSchemas } from './gigl.schemas';

function normalizeLocation(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class GiglStationsService {
  private stationsCache: GiglStation[] | null = null;
  private stationsCacheExpiry = 0;
  private stationsRequest: Promise<GiglStation[]> | null = null;

  constructor(private readonly apiClient: GiglApiClient) {}

  async getLocations(_countryCode = 'NG'): Promise<UnifiedLocation[]> {
    const stations = await this.getStations();
    return stations.map((station) => ({
      state: station.StateName || station.State || station.StationName,
      city: station.City || station.StationName,
      stationId: station.StationId,
      stationName: station.StationName,
      latitude: station.Latitude,
      longitude: station.Longitude,
    }));
  }

  getStations(
    timeout = GIGL_STATIONS_TIMEOUT_MS,
    signal?: AbortSignal
  ): Promise<GiglStation[]> {
    if (this.stationsCache && Date.now() < this.stationsCacheExpiry) {
      return Promise.resolve(this.stationsCache);
    }

    if (!this.stationsRequest) {
      this.stationsRequest = this.fetchStations(timeout, signal).finally(() => {
        this.stationsRequest = null;
      });
      void this.stationsRequest.catch(() => undefined);
    }

    return withGiglRequestTimeout(
      this.stationsRequest,
      timeout,
      signal,
      'GIGL stations request timed out',
      'GIGL stations request aborted'
    );
  }

  private async fetchStations(
    timeout: number,
    signal?: AbortSignal
  ): Promise<GiglStation[]> {
    const tokenData = await this.apiClient.getApiToken(timeout, signal);
    const { envelope, response } =
      await this.apiClient.safeFetchEnvelopeWithAccessToken(
        `${this.apiClient.baseUrl}/localstations/get`,
        tokenData,
        () => ({
          method: 'GET',
          timeout,
          signal,
        })
      );

    if (!response.ok) {
      throw new Error('Failed to fetch GIGL stations');
    }

    if (envelope?.status !== 200) {
      throw new Error('Invalid GIGL stations response');
    }

    const stations = this.apiClient.parseEnvelopeData(
      envelope,
      giglSchemas.stationsData,
      'stations'
    );
    if (stations.length === 0) {
      throw new Error('GIGL returned empty station list');
    }

    this.stationsCache = stations;
    this.stationsCacheExpiry = Date.now() + GIGL_STATIONS_CACHE_TTL_MS;

    return this.stationsCache;
  }

  async findStationById(
    stationId: number,
    timeout?: number,
    signal?: AbortSignal
  ): Promise<GiglStation | null> {
    const stations = await this.getStations(timeout, signal);
    return stations.find((station) => station.StationId === stationId) || null;
  }

  async findStationForCity(
    city: string,
    state: string,
    timeout?: number,
    signal?: AbortSignal
  ): Promise<GiglStation | null> {
    const stations = await this.getStations(timeout, signal);
    const normalizedCity = normalizeLocation(city);
    const normalizedState = normalizeLocation(state);

    let station = stations.find((s) => {
      const cityName = normalizeLocation(s.City || '');
      const stationName = normalizeLocation(s.StationName || '');
      return cityName === normalizedCity || stationName === normalizedCity;
    });

    if (!station) {
      station = stations.find((s) => {
        const stateName = normalizeLocation(s.StateName || s.State || '');
        return stateName === normalizedState;
      });
    }

    return station || null;
  }
}
