import { describe, expect, it, vi } from 'vitest';

describe('GIGL provider constants', () => {
  it('parses provider rate ids with station pickup and vehicle type', async () => {
    vi.resetModules();
    const { PickupOptions, VehicleType, parseGiglProviderRateId } =
      await import('./gigl.constants');

    expect(parseGiglProviderRateId('GIGL_30_1_2_575')).toEqual({
      receiverStationId: 30,
      pickupOption: PickupOptions.ServiceCentre,
      vehicleType: VehicleType.Van,
      serviceCentreId: 575,
      deliveryType: 0,
    });
  });

  it('parses legacy rate ids without a service-centre segment', async () => {
    vi.resetModules();
    const { PickupOptions, VehicleType, parseGiglProviderRateId } =
      await import('./gigl.constants');

    expect(parseGiglProviderRateId('GIGL_30_1_2')).toEqual({
      receiverStationId: 30,
      pickupOption: PickupOptions.ServiceCentre,
      vehicleType: VehicleType.Van,
      serviceCentreId: undefined,
      deliveryType: 0,
    });
  });

  it('round-trips priority rate ids without confusing the service centre', async () => {
    vi.resetModules();
    const {
      GiglDeliveryType,
      PickupOptions,
      VehicleType,
      buildGiglProviderRateId,
      parseGiglProviderRateId,
    } = await import('./gigl.constants');

    const providerRateId = buildGiglProviderRateId({
      receiverStationId: 30,
      pickupOption: PickupOptions.ServiceCentre,
      vehicleType: VehicleType.Bike,
      serviceCentreId: 575,
      deliveryType: GiglDeliveryType.GoFaster,
    });

    expect(providerRateId).toBe('GIGL_30_1_1_575_1');
    expect(parseGiglProviderRateId(providerRateId)).toEqual({
      receiverStationId: 30,
      pickupOption: PickupOptions.ServiceCentre,
      vehicleType: VehicleType.Bike,
      serviceCentreId: 575,
      deliveryType: GiglDeliveryType.GoFaster,
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

  it('uses the GIGL standard package id for shipment items', async () => {
    vi.resetModules();
    const { GIGL_DEFAULT_SPECIAL_PACKAGE_ID } = await import(
      './gigl.constants'
    );

    expect(GIGL_DEFAULT_SPECIAL_PACKAGE_ID).toBe(1);
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
