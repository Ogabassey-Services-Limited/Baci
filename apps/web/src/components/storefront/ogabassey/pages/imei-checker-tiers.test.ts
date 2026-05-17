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
      const sourceTier = IMEI_SERVICE_TIERS[tierKey];

      expect(SERVICE_TIERS[tierKey]).toMatchObject({
        features: sourceTier.features,
        id: tierKey,
        name: sourceTier.name,
        price: sourceTier.price,
        priceDisplay: expect.stringContaining(
          sourceTier.price.toLocaleString('en-NG')
        ),
        tagline: sourceTier.tagline,
      });

      if ('recommended' in sourceTier) {
        expect(SERVICE_TIERS[tierKey].recommended).toBe(sourceTier.recommended);
      } else {
        expect(SERVICE_TIERS[tierKey].recommended).toBeUndefined();
      }
    }
  });
});
