import { beforeEach, describe, expect, it, vi } from 'vitest';

const { persistAdminGiglQuote } = vi.hoisted(() => ({
  persistAdminGiglQuote: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('./persist-admin-gigl-quote', () => ({
  persistAdminGiglQuote,
}));

import { persistRefreshedShippingQuote } from './persist-refreshed-shipping-quote';

const checkoutQuote = {
  id: 'q1',
  provider: 'GIGL' as const,
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
};

describe('persistRefreshedShippingQuote', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    persistAdminGiglQuote.mockResolvedValue({ error: null });
  });

  it('persists checkout refreshes through the merchant-owned RPC', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
    };

    await expect(
      persistRefreshedShippingQuote(supabase as never, checkoutQuote, {
        merchantId: 'm1',
        sessionId: 's1',
        quoteRequest: {} as never,
      })
    ).resolves.toEqual({ error: null });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'persist_refreshed_merchant_shipping_quote',
      {
        p_quote: expect.objectContaining({
          id: 'q1',
          provider_metadata: null,
        }),
      }
    );
    expect(persistAdminGiglQuote).not.toHaveBeenCalled();
  });

  it('writes an order-scoped attestation for Admin GIGL wallet refreshes', async () => {
    const supabase = { rpc: vi.fn() };

    await expect(
      persistRefreshedShippingQuote(
        supabase as never,
        {
          ...checkoutQuote,
          id: 'q2',
          price: 12_000,
          providerRateId: 'GIGL_4_0',
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

    expect(persistAdminGiglQuote).toHaveBeenCalledWith({
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
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
