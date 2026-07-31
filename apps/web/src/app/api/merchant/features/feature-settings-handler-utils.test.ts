import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  revalidateFeatures: vi.fn(),
  revalidateMerchant: vi.fn(),
  revalidateRepairsCatalog: vi.fn(),
}));

vi.mock('@/lib/cache-revalidation', () => mocks);

import {
  hasNonEmptyGrowthIntegrationSetting,
  isUniqueViolation,
  revalidateMerchantFeatureCaches,
} from './feature-settings-handler-utils';

describe('feature settings handler utilities', () => {
  beforeEach(() => vi.clearAllMocks());

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

  it('revalidates the repairs catalog only when that setting changes', () => {
    revalidateMerchantFeatureCaches('merchant-1', { loyalty_enabled: true });
    expect(mocks.revalidateFeatures).toHaveBeenCalledWith('merchant-1');
    expect(mocks.revalidateMerchant).toHaveBeenCalledWith('merchant-1');
    expect(mocks.revalidateRepairsCatalog).not.toHaveBeenCalled();

    revalidateMerchantFeatureCaches('merchant-1', {
      repairs_catalog_enabled: true,
    });
    expect(mocks.revalidateRepairsCatalog).toHaveBeenCalledWith('merchant-1');
  });
});
