import { describe, expect, it } from 'vitest';
import { hasStorefrontPriceNegotiation } from '@/lib/storefront-price-negotiation';

describe('hasStorefrontPriceNegotiation', () => {
  it('returns true when the snapshot hint grants negotiation', () => {
    // Public snapshot merchants no longer carry plan_tier; the derived hint
    // is authoritative for presentation.
    expect(
      hasStorefrontPriceNegotiation({
        price_negotiation_enabled: true,
        slug: 'regular-store',
      })
    ).toBe(true);
  });

  it('returns false when the snapshot hint denies negotiation, even for legacy slugs', () => {
    // A false hint means the server already evaluated plan tier + legacy
    // fallback; the client must not re-derive a broader answer.
    expect(
      hasStorefrontPriceNegotiation({
        price_negotiation_enabled: false,
        slug: 'ogabassey',
      })
    ).toBe(false);
  });

  it('falls back to plan-tier entitlement when the hint is absent', () => {
    expect(
      hasStorefrontPriceNegotiation({ plan_tier: 'pro', slug: 'regular-store' })
    ).toBe(true);
    expect(
      hasStorefrontPriceNegotiation({ plan_tier: 'free', slug: 'ogabassey' })
    ).toBe(false);
  });

  it('falls back to the legacy slug allowlist when neither hint nor plan tier exists', () => {
    expect(hasStorefrontPriceNegotiation({ slug: 'ogabassey' })).toBe(true);
    expect(hasStorefrontPriceNegotiation({ slug: 'regular-store' })).toBe(
      false
    );
  });

  it('returns false for a missing merchant', () => {
    expect(hasStorefrontPriceNegotiation(null)).toBe(false);
    expect(hasStorefrontPriceNegotiation(undefined)).toBe(false);
  });
});
