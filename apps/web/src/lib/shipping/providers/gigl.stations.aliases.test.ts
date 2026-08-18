import { describe, expect, it, vi } from 'vitest';

describe('GIGL station state aliases', () => {
  it('matches Abuja requests with GIGL FCT station state names', async () => {
    const { GiglStationsService } = await import('./gigl.stations');
    const service = new GiglStationsService({} as never);
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
  });
});
