import { describe, expect, it } from 'vitest';

import {
  hasNonEmptyGrowthIntegrationSetting,
  isUniqueViolation,
} from './feature-settings-handler-utils';

describe('feature settings handler utilities', () => {
  it('recognizes non-empty growth integration credentials', () => {
    expect(
      hasNonEmptyGrowthIntegrationSetting({ ga4_api_secret: '  secret ' })
    ).toBe(true);
    expect(
      hasNonEmptyGrowthIntegrationSetting({ facebook_pixel_id: '   ' })
    ).toBe(false);
    expect(hasNonEmptyGrowthIntegrationSetting({ loyalty_enabled: true })).toBe(
      false
    );
  });

  it('recognizes only database unique-violation errors', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: 'other' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
