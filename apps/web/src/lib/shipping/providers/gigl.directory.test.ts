import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({ rpc }),
}));

describe('findNearestGiglServiceCentres', () => {
  beforeEach(() => rpc.mockReset());

  it('maps the nearest centre and its parent station', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          station_id: 4,
          station_name: 'LAGOS',
          station_code: 'LOS',
          service_centre_id: 65,
          service_centre_name: 'SANGO OTTA',
          service_centre_code: 'SOT',
          address: 'Sango Ota',
          latitude: 6.707,
          longitude: 3.243,
        },
      ],
      error: null,
    });
    const { findNearestGiglServiceCentres } = await import('./gigl.directory');

    await expect(findNearestGiglServiceCentres(6.68, 3.27)).resolves.toEqual({
      stationId: 4,
      serviceCentres: [
        expect.objectContaining({
          ServiceCentreId: 65,
          ServiceCentreName: 'SANGO OTTA',
          StationId: 4,
        }),
      ],
    });
  });

  it('does not convert a database failure into an empty directory', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    const { findNearestGiglServiceCentres } = await import('./gigl.directory');

    await expect(findNearestGiglServiceCentres(6.68, 3.27)).rejects.toEqual({
      message: 'timeout',
    });
  });

  it('passes the caller abort signal to the nearest-centre RPC', async () => {
    const abortSignal = vi.fn().mockResolvedValue({ data: [], error: null });
    rpc.mockReturnValue({ abortSignal });
    const signal = new AbortController().signal;
    const { findNearestGiglServiceCentres } = await import('./gigl.directory');

    await expect(
      findNearestGiglServiceCentres(6.68, 3.27, { signal, timeout: 5000 })
    ).resolves.toBeNull();
    expect(abortSignal).toHaveBeenCalledWith(signal);
  });
});
