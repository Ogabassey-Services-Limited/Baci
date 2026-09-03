import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdminClient = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
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
  });

  it('persists checkout refreshes through the service-role merchant RPC', async () => {
    const adminRpc = vi.fn().mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({ rpc: adminRpc });
    const supabase = { rpc: vi.fn() };

    await expect(
      persistRefreshedShippingQuote(supabase as never, checkoutQuote, {
        merchantId: 'm1',
        sessionId: 's1',
        quoteRequest: {} as never,
      })
    ).resolves.toEqual({ error: null });

    expect(createAdminClient).toHaveBeenCalledWith();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith(
      'persist_refreshed_merchant_shipping_quote',
      {
        p_quote: expect.objectContaining({
          id: 'q1',
          provider_metadata: null,
        }),
      }
    );
  });

  it('writes an order-scoped attestation through the authenticated client', async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ error: null }) };

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
          marginBasisPoints: 1_000,
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

    expect(createAdminClient).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith(
      'persist_refreshed_order_shipping_quote',
      expect.objectContaining({ p_order_id: 'order-1' })
    );
  });
});
