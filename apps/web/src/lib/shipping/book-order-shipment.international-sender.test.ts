import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/shipping', () => ({
  shippingService: {
    getProviderQuotes: vi.fn(),
    bookShipment: vi.fn(),
  },
}));

const { bookOrderShipment } = await import('./book-order-shipment');
const { shippingService } = await import('@/lib/shipping');

const savedQuoteRequest = {
  sessionId: 'quote-session-1',
  shipmentType: 'international' as const,
  sender: {
    name: 'Test Store',
    phone: '08098765432',
    address: '789 Quoted Warehouse',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  receiver: {
    name: 'Jane Receiver',
    phone: '08012345678',
    address: '123 Queen Street West',
    city: 'Toronto',
    state: 'Ontario',
    country: 'Canada',
    countryCode: 'CA',
  },
  items: [
    {
      name: 'Phone',
      quantity: 1,
      weight: 1.2,
      value: 100_000,
      hsCode: '851712',
      length: 10,
      width: 8,
      height: 6,
    },
  ],
};

function createSupabase(provider: 'GIGL' | 'TOPSHIP' = 'GIGL') {
  const order = {
    id: 'order-1',
    customer_name: 'Jane Doe',
    customer_email: 'jane@example.com',
    customer_phone: '08012345678',
    shipping_fee: 2500,
    selected_quote_id: 'quote-1',
    shipping_provider: provider,
    shipping_address: {
      address: '123 Queen Street West',
      city: 'Toronto',
      state: 'Ontario',
      country: 'Canada',
      countryCode: 'CA',
    },
    order_items: [
      {
        name: 'Phone',
        quantity: 1,
        price: 100_000,
        product: {
          weight_value: 1.2,
          weight_unit: 'kg',
          dimensions: { length: 10, width: 8, height: 6, unit: 'cm' },
          commodity_code: '851712',
        },
      },
    ],
  };
  const quote = {
    id: 'quote-1',
    merchant_id: 'merchant-1',
    provider,
    service_tier: 'International',
    carrier_name: 'GIG Logistics',
    price: 2500,
    currency: 'NGN',
    estimated_days: 7,
    provider_rate_id:
      provider === 'GIGL' ? 'GIGL_INTL_1_2_3_1' : 'Premium_Express',
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    quote_request: savedQuoteRequest,
    provider_metadata: {},
  };
  const orders = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: order, error: null }),
  };
  const quotes = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: quote, error: null }),
  };
  const shipments = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const merchants = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'origin unavailable' },
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'orders') return { select: vi.fn(() => orders) };
      if (table === 'shipping_quotes') {
        return {
          select: vi.fn(() => quotes),
          update: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            error: null,
          })),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'shipments') {
        return {
          select: vi.fn(() => shipments),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'shipment-1' },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === 'merchants') return { select: vi.fn(() => merchants) };
      throw new Error(`Unexpected table ${table}`);
    }),
  } as never;
}

describe('bugfix: international fulfillment preserves saved sender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shippingService.bookShipment).mockResolvedValue({
      provider: 'GIGL',
      providerShipmentId: 'prov-ship-1',
      trackingNumber: 'TRK123456',
      carrierName: 'GIG Logistics',
      status: 'booked',
      rawResponse: {},
    });
  });

  it('books with the saved sender when the current merchant origin is unavailable', async () => {
    await bookOrderShipment(createSupabase(), 'merchant-1', 'order-1');

    expect(shippingService.bookShipment).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({
        sender: expect.objectContaining({
          address: '789 Quoted Warehouse',
          country: 'Nigeria',
          countryCode: 'NG',
        }),
      })
    );
  });

  it('preserves the saved sender for Topship international quotes', async () => {
    vi.mocked(shippingService.bookShipment).mockResolvedValue({
      provider: 'TOPSHIP',
      providerShipmentId: 'prov-ship-2',
      trackingNumber: 'TRK654321',
      carrierName: 'Topship Express',
      status: 'booked',
      rawResponse: {},
    });

    await bookOrderShipment(createSupabase('TOPSHIP'), 'merchant-1', 'order-1');

    expect(shippingService.bookShipment).toHaveBeenCalledWith(
      'TOPSHIP',
      expect.objectContaining({
        sender: expect.objectContaining({
          address: '789 Quoted Warehouse',
          country: 'Nigeria',
          countryCode: 'NG',
        }),
      })
    );
  });
});
