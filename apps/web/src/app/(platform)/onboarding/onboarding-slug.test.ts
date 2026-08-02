import { describe, expect, it, vi } from 'vitest';
import {
  hasEstablishedOnboardingSlug,
  resolveOnboardingMerchantSlug,
} from './onboarding-slug';

describe('resolveOnboardingMerchantSlug', () => {
  it('uses the local normalized slug when the database resolver has no value', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

    await expect(
      resolveOnboardingMerchantSlug({ rpc }, 'Baci Food 123')
    ).resolves.toBe('baci-food-123');
    expect(hasEstablishedOnboardingSlug('merchant-chosen-slug')).toBe(true);
    expect(hasEstablishedOnboardingSlug('   ')).toBe(false);
    expect(hasEstablishedOnboardingSlug(null)).toBe(false);
  });

  it('keeps the database-issued slug for a collision-safe result', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'baci-food-2', error: null });

    await expect(
      resolveOnboardingMerchantSlug({ rpc }, 'Baci Food')
    ).resolves.toBe('baci-food-2');
  });
});
