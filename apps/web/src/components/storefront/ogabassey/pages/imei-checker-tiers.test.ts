import {
  IMEI_SERVICE_TIERS,
  PRIMARY_IMEI_SERVICE_TIERS,
} from '@baci/shared/imei';
import { describe, expect, it } from 'vitest';
import { SERVICE_TIERS } from './imei-checker-tiers';

describe('SERVICE_TIERS', () => {
  it('uses the public shared IMEI tiers as its source of truth', () => {
    expect(Object.keys(SERVICE_TIERS)).toEqual([...PRIMARY_IMEI_SERVICE_TIERS]);

    for (const tierKey of PRIMARY_IMEI_SERVICE_TIERS) {
      expect(SERVICE_TIERS[tierKey]).toMatchObject({
        features: IMEI_SERVICE_TIERS[tierKey].features,
        id: tierKey,
        name: IMEI_SERVICE_TIERS[tierKey].name,
        price: IMEI_SERVICE_TIERS[tierKey].price,
        priceDisplay: expect.stringContaining(
          IMEI_SERVICE_TIERS[tierKey].price.toLocaleString('en-NG')
        ),
        tagline: IMEI_SERVICE_TIERS[tierKey].tagline,
      });
    }
  });
});
