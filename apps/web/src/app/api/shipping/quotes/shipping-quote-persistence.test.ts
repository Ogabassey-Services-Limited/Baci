import { describe, expect, it } from 'vitest';
import { toShippingQuoteUpsert } from './shipping-quote-persistence';

describe('toShippingQuoteUpsert', () => {
  it('persists bundled GIGL price and internal split', () => {
    const row = toShippingQuoteUpsert(
      {
        id: 'q',
        provider: 'GIGL',
        serviceTier: 'GoStandard',
        carrierName: 'GIG Logistics',
        displayName: 'GIG Logistics',
        estimatedDays: 2,
        price: 11000,
        currency: 'NGN',
        pickupIncluded: true,
        insuranceIncluded: true,
        expiresAt: new Date('2026-01-01'),
        providerCost: 10000,
        platformMargin: 1000,
        marginBasisPoints: 1000,
        pricingVersion: 'gigl_platform_margin_v1',
      },
      { merchantId: 'm', sessionId: 's', quoteRequest: {} as never }
    );
    expect(row).toMatchObject({
      price: 11000,
      provider_cost: 10000,
      platform_margin: 1000,
      platform_margin_bps: 1000,
      pricing_version: 'gigl_platform_margin_v1',
    });
  });
});
