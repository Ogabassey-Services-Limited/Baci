import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/shipping', () => ({
  shippingService: {
    getProviderQuotes: vi.fn(),
    bookShipment: vi.fn(),
  },
}));

const { bookOrderShipment } = await import('./book-order-shipment');
const { shippingService } = await import('@/lib/shipping');

const order = {
  id: 'order-1',
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com',
  customer_phone: '08012345678',
  selected_quote_id: 'quote-1',
  shipping_provider: 'GIGL',
  shipping_address: {
    address: '123 Main St',
    city: 'Lagos',
    state: 'Lagos',
    phone: '08012345678',
  },
  order_items: [{ name: 'Phone', quantity: 1, price: 100_000 }],
};

const merchant = {
  business_name: 'Test Store',
  business_address: '456 Market Rd, Lagos',
  phone: '08098765432',
};

const quoteRequest = {
  sessionId: 'quote-session-1',
  shipmentType: 'international',
  sender: {
    name: 'Test Store',
    phone: '08098765432',
    address: '456 Market Rd',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  receiver: {
    name: 'Jane Receiver',
    phone: '+14165550123',
    email: 'jane@example.com',
    address: '123 Queen Street West',
    city: 'Toronto',
    state: 'Ontario',
    country: 'Canada',
    countryCode: 'CA',
    postalCode: 'M5V 3L9',
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

function createSupabase(
  savedQuoteRequest: typeof quoteRequest | null,
  onShipmentInsert?: (payload: unknown) => void
) {
  const ordersSelect = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: order, error: null }),
  };
  const existingShipmentSelect = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const quoteSelect = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'quote-1',
        provider: 'GIGL',
        service_tier: 'International',
        carrier_name: 'GIG Logistics',
        price: 2500,
        currency: 'NGN',
        estimated_days: 7,
        provider_rate_id: 'GIGL_INTL_1_2_3_4',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        quote_request: savedQuoteRequest,
        provider_metadata: {},
      },
      error: null,
    }),
  };
  const merchantSelect = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: merchant, error: null }),
  };
  const shipmentInsert = {
    select: vi.fn().mockReturnValue({
      single: vi
        .fn()
        .mockResolvedValue({ data: { id: 'shipment-1' }, error: null }),
    }),
  };
  const quoteUpdate = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'orders') return { select: vi.fn(() => ordersSelect) };
      if (table === 'shipping_quotes') {
        return {
          select: vi.fn(() => quoteSelect),
          update: vi.fn(() => quoteUpdate),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'merchants') return { select: vi.fn(() => merchantSelect) };
      if (table === 'shipments') {
        return {
          select: vi.fn(() => existingShipmentSelect),
          insert: vi.fn((payload: unknown) => {
            onShipmentInsert?.(payload);
            return shipmentInsert;
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as Parameters<typeof bookOrderShipment>[0];
}

describe('bookOrderShipment GIGL international quotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the saved quote destination and item metadata', async () => {
    const insertedShipments: unknown[] = [];
    vi.mocked(shippingService.bookShipment).mockResolvedValue({
      provider: 'GIGL',
      providerShipmentId: 'prov-ship-1',
      trackingNumber: 'TRK123456',
      carrierName: 'GIG Logistics',
      status: 'booked',
      rawResponse: {},
    });

    await bookOrderShipment(
      createSupabase(quoteRequest, (payload) =>
        insertedShipments.push(payload)
      ),
      'merchant-1',
      'order-1'
    );

    expect(shippingService.bookShipment).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({
        sender: expect.objectContaining({
          country: 'Nigeria',
          countryCode: 'NG',
        }),
        receiver: expect.objectContaining({
          city: 'Toronto',
          country: 'Canada',
          countryCode: 'CA',
        }),
        items: [
          expect.objectContaining({
            hsCode: '851712',
            length: 10,
            width: 8,
            height: 6,
          }),
        ],
      })
    );
    expect(insertedShipments[0]).toEqual(
      expect.objectContaining({
        sender_address: expect.objectContaining({
          country: 'Nigeria',
          countryCode: 'NG',
        }),
        receiver_address: expect.objectContaining({
          country: 'Canada',
          countryCode: 'CA',
        }),
        items: [
          expect.objectContaining({
            hsCode: '851712',
            length: 10,
            width: 8,
            height: 6,
          }),
        ],
      })
    );
  });

  it('rejects bookings without the saved quote request', async () => {
    const booking = bookOrderShipment(
      createSupabase(null),
      'merchant-1',
      'order-1'
    );

    await expect(booking).rejects.toThrow('missing its original request');
    await expect(booking).rejects.toMatchObject({
      code: 'INTERNATIONAL_QUOTE_REQUEST_MISSING',
      status: 400,
    });
  });
});
