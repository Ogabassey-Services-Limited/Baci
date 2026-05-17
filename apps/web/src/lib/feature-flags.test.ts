import { describe, expect, it } from 'vitest';
import { FEATURES, isPlanTier, planHasFeature } from '@/lib/feature-flags';

describe('feature flags', () => {
  it('recognizes supported plan tiers at runtime', () => {
    expect(isPlanTier('free')).toBe(true);
    expect(isPlanTier('starter')).toBe(true);
    expect(isPlanTier('pro')).toBe(true);
    expect(isPlanTier('business')).toBe(true);
    expect(isPlanTier('enterprise')).toBe(true);
  });

  it('rejects unknown or absent plan tiers', () => {
    expect(isPlanTier('legacy-plan')).toBe(false);
    expect(isPlanTier(null)).toBe(false);
    expect(isPlanTier(undefined)).toBe(false);
  });

  it('keeps price negotiation gated to pro and above', () => {
    expect(planHasFeature('free', FEATURES.PRICE_NEGOTIATION)).toBe(false);
    expect(planHasFeature('starter', FEATURES.PRICE_NEGOTIATION)).toBe(false);
    expect(planHasFeature('pro', FEATURES.PRICE_NEGOTIATION)).toBe(true);
    expect(planHasFeature('business', FEATURES.PRICE_NEGOTIATION)).toBe(true);
    expect(planHasFeature('enterprise', FEATURES.PRICE_NEGOTIATION)).toBe(true);
  });
});
