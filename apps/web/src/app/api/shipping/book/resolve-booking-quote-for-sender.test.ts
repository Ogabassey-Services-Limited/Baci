import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShippingAddress } from '@/lib/shipping/types';

const mockRefreshOrderShipmentQuote = vi.fn();

vi.mock('@/lib/shipping/refresh-order-shipment-quote', () => ({
  refreshOrderShipmentQuote: (...args: unknown[]) =>
    mockRefreshOrderShipmentQuote(...args),
}));

const { resolveBookingQuoteForSender } = await import(
  './resolve-booking-quote-for-sender'
);

const merchantSender: ShippingAddress = {
  name: 'Merchant',
  phone: '08000000000',
  address: '9 Registered Road, Ikeja, Lagos',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};

const quote = {
  id: 'quote-1',
  merchant_id: 'merchant-1',
  provider: 'GIGL',
  service_tier: 'GoStandard',
  carrier_name: 'GIG Logistics',
  price: 2500,
  currency: 'NGN',
  estimated_days: 3,
  provider_rate_id: 'GIGL_4_0',
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  quote_request: {},
  provider_metadata: {},
};

describe('resolveBookingQuoteForSender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshOrderShipmentQuote.mockResolvedValue({
      ...quote,
      id: 'quote-refreshed',
    });
  });

  it('returns the stored quote unchanged for international bookings', async () => {
    const result = await resolveBookingQuoteForSender(
      {} as never,
      quote,
      'GIGL',
      {
        merchantSender,
        usesStoredInternationalSender: true,
      }
    );

    expect(result).toBe(quote);
    expect(mockRefreshOrderShipmentQuote).not.toHaveBeenCalled();
  });

  describe('bugfix: domestic sender mismatch on book route', () => {
    it('refreshes the quote against the registered merchant sender', async () => {
      const supabase = { from: vi.fn() };

      const result = await resolveBookingQuoteForSender(
        supabase as never,
        quote,
        'GIGL',
        {
          merchantSender,
          usesStoredInternationalSender: false,
        }
      );

      expect(mockRefreshOrderShipmentQuote).toHaveBeenCalledWith(
        supabase,
        quote,
        'GIGL',
        merchantSender
      );
      expect(result.id).toBe('quote-refreshed');
    });
  });
});
