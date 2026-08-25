import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderShipmentBookingError } from '@/lib/shipping/order-shipment-booking-utils';
import type { ShippingAddress } from '@/lib/shipping/types';

vi.mock('@/lib/shipping', () => ({
  shippingService: {
    getProviderQuotes: vi.fn(),
  },
}));

const { refreshOrderShipmentQuote } = await import(
  './refresh-order-shipment-quote'
);
const { shippingService } = await import('@/lib/shipping');

const storedSender: ShippingAddress = {
  name: 'Merchant',
  phone: '08000000000',
  address: '2 Olaide Tomori Street, Ikeja, Lagos',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};

const correctedSender: ShippingAddress = {
  name: 'Merchant',
  phone: '08000000000',
  address: '2 Olaide Tomori Street, Ikeja, Lagos',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};

function createQuote(overrides?: {
  expiresAt?: string;
  sender?: ShippingAddress;
}) {
  return {
    id: 'quote-1',
    merchant_id: 'merchant-1',
    provider: 'GIGL',
    service_tier: 'GoStandard',
    carrier_name: 'GIG Logistics',
    price: 2500,
    currency: 'NGN',
    estimated_days: 3,
    provider_rate_id: 'GIGL_4_0',
    expires_at:
      overrides?.expiresAt ?? new Date(Date.now() + 86_400_000).toISOString(),
    quote_request: {
      shipmentType: 'domestic' as const,
      sessionId: 'session-1',
      sender: overrides?.sender ?? storedSender,
      receiver: correctedSender,
      items: [{ name: 'Widget', quantity: 1, weight: 1, value: 5000 }],
    },
    provider_metadata: {},
  };
}

function createSupabase(
  upsertError: { code: string; message: string } | null = null
) {
  return {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: upsertError }),
    }),
  };
}

describe('refreshOrderShipmentQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const quote = createQuote({ sender: correctedSender });

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
    const quote = createQuote({ sender: storedSender });
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
    expect(supabase.from).toHaveBeenCalledWith('shipping_quotes');
  });

  it('refreshes an unexpired domestic quote when its saved sender is missing', async () => {
    const storedQuote = createQuote({ sender: correctedSender });
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
      const quote = createQuote({
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
