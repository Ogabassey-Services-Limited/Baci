import { describe, expect, it, vi } from 'vitest';

describe('GIGL station state aliases', () => {
  it('matches Abuja requests with GIGL FCT station state names', async () => {
    const { GiglApiClient } = await import('./gigl.auth');
    const { GiglStationsService } = await import('./gigl.stations');
    const safeFetch = (
      url: string,
      options?: RequestInit & { timeout?: number }
    ) => fetch(url, options);
    const service = new GiglStationsService(
      new GiglApiClient({ safeFetch, log: vi.fn() })
    );
    vi.spyOn(service, 'getStations').mockResolvedValue([
      {
        StationId: 4,
        StationName: 'ABUJA',
        StateName: 'FCT - Abuja',
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
        city: 'Kubwa',
        state: 'Abuja',
      })
    ).resolves.toEqual({
      station: expect.objectContaining({ StationId: 4 }),
    });

    await expect(service.findStationForCity('Kubwa', 'Abuja')).resolves.toEqual(
      expect.objectContaining({
        StationId: 4,
        StateName: 'FCT - Abuja',
      })
    );
  });
});
