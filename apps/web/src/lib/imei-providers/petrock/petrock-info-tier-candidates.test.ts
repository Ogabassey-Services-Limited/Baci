import { PETROCK_DARK_IMEI_SERVICE_TIERS } from '@baci/shared/imei';
import { describe, expect, it } from 'vitest';
import { PETROCK_INFO_TIER_CANDIDATES } from './petrock-info-tier-candidates';

describe('PETROCK_INFO_TIER_CANDIDATES', () => {
  it('records every dark Phase 3 tier server-side without launch-enabling it', () => {
    expect(Object.keys(PETROCK_INFO_TIER_CANDIDATES).sort()).toEqual(
      [...PETROCK_DARK_IMEI_SERVICE_TIERS].sort()
    );

    for (const candidate of Object.values(PETROCK_INFO_TIER_CANDIDATES)) {
      expect(candidate.fixtureVerified).toBe(false);
      expect(candidate.productId).toMatch(/^\d+$/);
    }
  });

  it('preserves the one empirically known trailing-space field exactly', () => {
    expect(PETROCK_INFO_TIER_CANDIDATES.macInfo.orderFieldName).toBe(
      'Serial Number '
    );
  });
});
