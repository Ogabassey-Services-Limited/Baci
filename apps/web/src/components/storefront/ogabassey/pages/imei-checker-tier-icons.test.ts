import { describe, expect, it } from 'vitest';
import { PUBLIC_IMEI_SERVICE_TIERS } from '@baci/shared/imei';
import { DEFAULT_TIER_ICON, getTierIcon } from './imei-checker-tier-icons';

describe('getTierIcon', () => {
  it('returns a mapped icon for every publicly purchasable tier key', () => {
    for (const tierKey of PUBLIC_IMEI_SERVICE_TIERS) {
      expect(getTierIcon(tierKey)).toBeTypeOf('object');
    }
  });

  it('falls back to the default icon for an unmapped key', () => {
    // Cast: exercising the defensive fallback for a catalog key that doesn't
    // exist in IMEI_TIER_ICONS (e.g. a future tier added to the shared package
    // before this map is updated).
    expect(getTierIcon('not-a-real-tier' as never)).toBe(DEFAULT_TIER_ICON);
  });
});
