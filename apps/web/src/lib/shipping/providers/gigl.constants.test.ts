import { describe, expect, it, vi } from 'vitest';

describe('GIGL provider constants', () => {
  it('parses provider rate ids with station pickup and vehicle type', async () => {
    vi.resetModules();
    const { PickupOptions, VehicleType, parseGiglProviderRateId } =
      await import('./gigl.constants');

    expect(parseGiglProviderRateId('GIGL_30_1_2')).toEqual({
      receiverStationId: 30,
      pickupOption: PickupOptions.ServiceCentre,
      vehicleType: VehicleType.Van,
    });
  });

  it.each([
    'false',
    'FALSE',
    ' False ',
    '0',
    ' 0 ',
    'off',
    'OFF',
    ' Off ',
  ])('treats %s as an explicit GIGL disable value', async (value) => {
    vi.resetModules();
    const { isExplicitlyDisabledEnv } = await import('./gigl.constants');

    expect(isExplicitlyDisabledEnv(value)).toBe(true);
  });

  it.each([
    undefined,
    '',
    ' ',
    'true',
    '1',
    'on',
    'disabled',
    'no',
  ])('does not treat %s as an explicit GIGL disable value', async (value) => {
    vi.resetModules();
    const { isExplicitlyDisabledEnv } = await import('./gigl.constants');

    expect(isExplicitlyDisabledEnv(value)).toBe(false);
  });

  it('requires an explicit base URL in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GIGL_BASE_URL', '   ');
    vi.resetModules();

    const { getConfiguredGiglBaseUrl } = await import('./gigl.constants');

    expect(() => getConfiguredGiglBaseUrl()).toThrow(
      'GIGL base URL not configured'
    );
    vi.unstubAllEnvs();
  });
});
