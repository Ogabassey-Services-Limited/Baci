import { describe, expect, it } from 'vitest';
import { PickupOptions } from './gigl.constants';
import {
  internationalRateId,
  isGiglInternationalProviderRate,
  parseInternationalRateId,
} from './gigl.international-rate-id';

describe('GIGL international rate IDs', () => {
  it('accepts only parseable provider rate IDs', () => {
    const rateId = internationalRateId({
      deliveryType: 2,
      logisticsCompany: 0,
      shipmentMethod: 0,
      pickupOption: PickupOptions.ServiceCentre,
    });

    expect(parseInternationalRateId(rateId)).toEqual({
      deliveryType: 2,
      logisticsCompany: 0,
      shipmentMethod: 0,
      pickupOption: PickupOptions.ServiceCentre,
    });
    expect(isGiglInternationalProviderRate('GIGL', rateId)).toBe(true);
    expect(isGiglInternationalProviderRate('GIGL', 'GIGL_INTL_2_BAD_0_1')).toBe(
      false
    );
  });
});
