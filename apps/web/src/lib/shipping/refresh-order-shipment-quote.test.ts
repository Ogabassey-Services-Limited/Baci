import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderShipmentBookingError } from '@/lib/shipping/order-shipment-booking-utils';
import {
  correctedSender,
  createRefreshOrderQuote,
  storedSender,
} from './refresh-order-shipment-quote.test-support';

vi.mock('@/lib/shipping', () => ({
  shippingService: {
    getProviderQuotes: vi.fn(),
  },
}));

vi.mock('server-only', () => ({}));

const adminMocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  adminRpc: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: adminMocks.createAdminClient,
}));

const { refreshOrderShipmentQuote } = await import(
  './refresh-order-shipment-quote'
);
const { shippingService } = await import('@/lib/shipping');

function createSupabase(
  upsertError: { code: string; message: string } | null = null
) {
  adminMocks.adminRpc.mockResolvedValue({ error: upsertError });
  adminMocks.createAdminClient.mockReturnValue({ rpc: adminMocks.adminRpc });
  return {
    rpc: vi.fn().mockResolvedValue({ error: upsertError }),
  };
}

describe('refreshOrderShipmentQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.adminRpc.mockResolvedValue({ error: null });
    adminMocks.createAdminClient.mockReturnValue({ rpc: adminMocks.adminRpc });
    vi.mocked(shippingService.getProviderQuotes).mockResolvedValue([
      {
        id: 'quote-refreshed',
        provider: 'GIGL',
        serviceTier: 'GoStandard',
        carrierName: 'GIG Logistics',
        displayName: 'GIG Logistics - GoStandard',
        price: 2500,
        currency: 'NGN',
        estimatedDays: 3,
        pickupIncluded: true,
        insuranceIncluded: false,
        providerRateId: 'GIGL_4_0',
        expiresAt: new Date(Date.now() + 86_400_000),
        rawResponse: { refreshed: true },
      },
    ]);
  });

  it('returns the stored quote when it is unexpired and the sender already matches', async () => {
    const quote = createRefreshOrderQuote({ sender: correctedSender });

    const result = await refreshOrderShipmentQuote(
      createSupabase() as never,
      quote,
      'GIGL',
      correctedSender
    );

    expect(result).toBe(quote);
    expect(shippingService.getProviderQuotes).not.toHaveBeenCalled();
  });

  it('refreshes and persists when an unexpired domestic sender differs', async () => {
    const quote = createRefreshOrderQuote({ sender: storedSender });
    const supabase = createSupabase();

    const result = await refreshOrderShipmentQuote(
      supabase as never,
      quote,
      'GIGL',
      correctedSender
    );

    expect(shippingService.getProviderQuotes).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({ sender: correctedSender })
    );
    expect(result.id).toBe('quote-refreshed');
    expect(adminMocks.createAdminClient).toHaveBeenCalledWith();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(adminMocks.adminRpc).toHaveBeenCalledWith(
      'persist_refreshed_merchant_shipping_quote',
      expect.objectContaining({
        p_quote: expect.objectContaining({ id: 'quote-refreshed' }),
      })
    );
  });

  it('attests a refreshed Admin GIGL quote to the wallet order', async () => {
    const quote = {
      ...createRefreshOrderQuote({
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      quote_request: {
        ...createRefreshOrderQuote().quote_request,
        admin_order_provenance: 'server_gigl_v1' as const,
      },
    };
    const supabase = createSupabase();

    const result = await refreshOrderShipmentQuote(
      supabase as never,
      quote,
      'GIGL',
      correctedSender,
      { orderId: 'order-1' }
    );

    expect(result.id).toBe('quote-refreshed');
    expect(adminMocks.createAdminClient).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith(
      'persist_refreshed_order_shipping_quote',
      expect.objectContaining({
        p_order_id: 'order-1',
        p_quote: expect.objectContaining({
          id: 'quote-refreshed',
          merchant_id: 'merchant-1',
          session_id: 'order-1',
          provider: 'GIGL',
        }),
      })
    );
  });

  it('fails before the provider when refresh is disabled for a stale wallet quote', async () => {
    const quote = createRefreshOrderQuote({
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    await expect(
      refreshOrderShipmentQuote(
        createSupabase() as never,
        quote,
        'GIGL',
        correctedSender,
        { allowRefresh: false }
      )
    ).rejects.toMatchObject({
      code: 'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED',
      status: 409,
    });
    expect(shippingService.getProviderQuotes).not.toHaveBeenCalled();
  });

  it('fails before the provider when refresh is disabled for a changed sender', async () => {
    const quote = createRefreshOrderQuote({ sender: storedSender });

    await expect(
      refreshOrderShipmentQuote(
        createSupabase() as never,
        quote,
        'GIGL',
        correctedSender,
        { allowRefresh: false }
      )
    ).rejects.toMatchObject({
      code: 'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED',
      status: 409,
    });
    expect(shippingService.getProviderQuotes).not.toHaveBeenCalled();
  });

  it('preserves the selected pickup centre when refreshing a legacy GIGL rate ID', async () => {
    const quote = {
      ...createRefreshOrderQuote({ sender: storedSender }),
      provider_rate_id: 'GIGL_30_1_1_575_0',
    };
    vi.mocked(shippingService.getProviderQuotes).mockResolvedValueOnce([
      {
        id: 'wrong-centre',
        provider: 'GIGL',
        serviceTier: 'GoStandard',
        carrierName: 'GIG Logistics',
        displayName: 'Pickup at another centre',
        price: 2400,
        currency: 'NGN',
        estimatedDays: 3,
        pickupIncluded: true,
        insuranceIncluded: false,
        providerRateId: 'GIGL_30_1_1_576_0_4',
        expiresAt: new Date('2099-01-02T00:00:00.000Z'),
        rawResponse: {},
      },
      {
        id: 'selected-centre',
        provider: 'GIGL',
        serviceTier: 'GoStandard',
        carrierName: 'GIG Logistics',
        displayName: 'Pickup at selected centre',
        price: 2500,
        currency: 'NGN',
        estimatedDays: 3,
        pickupIncluded: true,
        insuranceIncluded: false,
        providerRateId: 'GIGL_30_1_1_575_0_4',
        expiresAt: new Date('2099-01-02T00:00:00.000Z'),
        rawResponse: {},
      },
    ]);

    const result = await refreshOrderShipmentQuote(
      createSupabase() as never,
      quote,
      'GIGL',
      correctedSender
    );

    expect(result.id).toBe('selected-centre');
    expect(result.provider_rate_id).toBe('GIGL_30_1_1_575_0_4');
  });

  it('refreshes an unexpired domestic quote when its saved sender is missing', async () => {
    const storedQuote = createRefreshOrderQuote({ sender: correctedSender });
    const { sender: _sender, ...quoteRequestWithoutSender } =
      storedQuote.quote_request;
    const quote = {
      ...storedQuote,
      quote_request: quoteRequestWithoutSender,
    };

    await refreshOrderShipmentQuote(
      createSupabase() as never,
      quote,
      'GIGL',
      correctedSender
    );

    expect(shippingService.getProviderQuotes).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({ sender: correctedSender })
    );
  });

  describe('bugfix: upsert failure must not continue booking', () => {
    it('throws QUOTE_REFRESH_PERSIST_FAILED when the refreshed quote cannot be saved', async () => {
      const quote = createRefreshOrderQuote({
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      });
      const upsertError = { code: '42501', message: 'permission denied' };

      await expect(
        refreshOrderShipmentQuote(
          createSupabase(upsertError) as never,
          quote,
          'GIGL',
          correctedSender
        )
      ).rejects.toMatchObject({
        code: 'QUOTE_REFRESH_PERSIST_FAILED',
      } satisfies Partial<OrderShipmentBookingError>);
    });
  });
});
