import {
  FEATURES,
  hasPriceNegotiationEntitlement,
  isPlanTier,
  planHasFeature,
} from '@/lib/feature-flags';

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

  describe('hasPriceNegotiationEntitlement', () => {
    it('returns true for pro, business, and enterprise plans', () => {
      expect(hasPriceNegotiationEntitlement('pro', 'any-slug')).toBe(true);
      expect(hasPriceNegotiationEntitlement('business', 'any-slug')).toBe(true);
      expect(hasPriceNegotiationEntitlement('enterprise', 'any-slug')).toBe(
        true
      );
    });

    it('returns false for free and starter plans', () => {
      expect(hasPriceNegotiationEntitlement('free', 'any-slug')).toBe(false);
      expect(hasPriceNegotiationEntitlement('starter', 'any-slug')).toBe(false);
    });

    it('falls back to legacy slugs when plan_tier is absent', () => {
      expect(hasPriceNegotiationEntitlement(null, 'ogabassey')).toBe(true);
      expect(hasPriceNegotiationEntitlement(undefined, 'demo-premium')).toBe(
        true
      );
      expect(hasPriceNegotiationEntitlement(null, 'other-merchant')).toBe(
        false
      );
    });

    it('returns false when plan_tier is present but malformed/invalid', () => {
      expect(hasPriceNegotiationEntitlement('invalid_tier', 'ogabassey')).toBe(
        false
      );
    });
  });
});
