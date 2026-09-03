import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  persistAdminGiglQuote: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock('./persist-admin-gigl-quote', () => ({
  persistAdminGiglQuote: mocks.persistAdminGiglQuote,
}));

import { persistRefreshedShippingQuote } from './persist-refreshed-shipping-quote';

describe('persistRefreshedShippingQuote', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.persistAdminGiglQuote.mockResolvedValue({ error: null });
  });

  it('uses the trusted server writer for refreshed quote economics', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ upsert }),
    });

    await expect(
      persistRefreshedShippingQuote(
        {
          id: 'q1',
          provider: 'GIGL',
          serviceTier: 'GoStandard',
          carrierName: 'GIG Logistics',
          displayName: 'GIG Logistics',
          estimatedDays: 2,
          price: 11_000,
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: false,
          expiresAt: new Date('2026-01-01'),
          rawResponse: { secret: 'never persisted' },
        },
        {
          merchantId: 'm1',
          sessionId: 's1',
          quoteRequest: {} as never,
        }
      )
    ).resolves.toEqual({ error: null });

    expect(mocks.createAdminClient).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'q1',
        provider_metadata: null,
      }),
      { onConflict: 'id' }
    );
  });

  it('writes an order-scoped attestation for Admin GIGL wallet refreshes', async () => {
    await expect(
      persistRefreshedShippingQuote(
        {
          id: 'q2',
          provider: 'GIGL',
          serviceTier: 'GoStandard',
          carrierName: 'GIG Logistics',
          displayName: 'GIG Logistics',
          estimatedDays: 2,
          price: 12_000,
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: false,
          providerRateId: 'GIGL_4_0',
          expiresAt: new Date('2026-01-01'),
          rawResponse: { ignored: true },
          providerCost: 10_000,
          platformMargin: 2_000,
          marginBasisPoints: 2_000,
          pricingVersion: 'gigl_platform_margin_v1',
        },
        {
          merchantId: 'merchant-1',
          sessionId: 'order-1',
          orderId: 'order-1',
          quoteRequest: {
            sessionId: 'refresh-session',
            shipmentType: 'domestic',
            receiver: {
              name: 'Customer',
              phone: '08000000000',
              address: '1 Main Street',
              city: 'Lagos',
              state: 'Lagos',
              country: 'Nigeria',
              countryCode: 'NG',
            },
            items: [],
            admin_order_provenance: 'server_gigl_v1',
          },
        }
      )
    ).resolves.toEqual({ error: null });

    expect(mocks.persistAdminGiglQuote).toHaveBeenCalledWith({
      quote: expect.objectContaining({
        id: 'q2',
        provider: 'GIGL',
        merchant_id: 'merchant-1',
        session_id: 'order-1',
        provider_cost: 10_000,
        platform_margin: 2_000,
        pricing_version: 'gigl_platform_margin_v1',
      }),
      attestation: {
        quote_id: 'q2',
        order_id: 'order-1',
        merchant_id: 'merchant-1',
        provider_rate_id: 'GIGL_4_0',
        quote_request: expect.objectContaining({
          admin_order_provenance: 'server_gigl_v1',
        }),
      },
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
