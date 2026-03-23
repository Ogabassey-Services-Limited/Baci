import { describe, expect, it, vi } from 'vitest';
import { OrderShipmentBookingError } from '@/lib/shipping/order-shipment-booking-utils';

vi.mock('@/lib/shipping', () => ({
  shippingService: {
    getProviderQuotes: vi.fn(),
    bookShipment: vi.fn(),
  },
}));

vi.mock(
  '@/lib/shipping/order-shipment-booking-utils',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/lib/shipping/order-shipment-booking-utils')
      >();
    return {
      ...actual,
      buildReceiver: vi.fn().mockReturnValue({
        name: 'Jane Doe',
        phone: '08012345678',
        address: '123 Main St',
        city: 'Lagos',
        state: 'Lagos',
      }),
      buildSender: vi.fn().mockReturnValue({
        name: 'Test Store',
        phone: '08098765432',
        address: '456 Market Rd',
        city: 'Lagos',
        state: 'Lagos',
      }),
      toShipmentItems: vi
        .fn()
        .mockReturnValue([{ name: 'Widget', quantity: 2, weight: 1 }]),
    };
  }
);

// Import after mocks are set up
const { bookOrderShipment } = await import('./book-order-shipment');
const { shippingService } = await import('@/lib/shipping');

type MockChain = {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};

function createMockSupabase(overrides?: {
  order?: { data: unknown; error: unknown };
  quote?: { data: unknown; error: unknown };
  merchant?: { data: unknown; error: unknown };
  shipmentInsert?: { data: unknown; error: unknown };
}) {
  let callIndex = 0;
  const responses = [
    overrides?.order ?? { data: null, error: { message: 'not configured' } },
    overrides?.quote ?? { data: null, error: { message: 'not configured' } },
    overrides?.merchant ?? { data: null, error: { message: 'not configured' } },
  ];

  const chain: MockChain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => {
      const response = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return Promise.resolve(response);
    }),
    insert: vi.fn().mockImplementation(() => {
      callIndex = 100; // skip to shipment insert
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(
            overrides?.shipmentInsert ?? {
              data: { id: 'shipment-1' },
              error: null,
            }
          ),
        }),
      };
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };

  return chain as unknown as Parameters<typeof bookOrderShipment>[0];
}

const validOrder = {
  id: 'order-1',
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com',
  customer_phone: '08012345678',
  selected_quote_id: 'quote-1',
  shipping_provider: 'TOPSHIP',
  shipping_address: {
    address: '123 Main St',
    city: 'Lagos',
    state: 'Lagos',
    phone: '08012345678',
  },
  order_items: [{ name: 'Widget', quantity: 2, price: 5000 }],
};

const validQuote = {
  id: 'quote-1',
  provider: 'TOPSHIP',
  service_tier: 'standard',
  carrier_name: 'Topship Express',
  price: 2500,
  currency: 'NGN',
  estimated_days: 3,
  provider_rate_id: 'rate-1',
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  quote_request: null,
  provider_metadata: {
    pricingTier: 'Premium',
    serviceType: 'Express Plus Shipping',
    cost: 700000,
  },
};

const validMerchant = {
  business_name: 'Test Store',
  business_address: '456 Market Rd, Lagos',
  phone: '08098765432',
};

const bookingResult = {
  provider: 'TOPSHIP' as const,
  providerShipmentId: 'prov-ship-1',
  trackingNumber: 'TRK123456',
  carrierName: 'Topship Express',
  status: 'booked' as const,
  labelUrl: 'https://example.com/label.pdf',
  pickupScheduledAt: new Date('2026-03-25'),
  rawResponse: {},
};

describe('bookOrderShipment', () => {
  it('throws ORDER_NOT_FOUND when order does not exist', async () => {
    const supabase = createMockSupabase({
      order: { data: null, error: { message: 'not found' } },
    });

    await expect(
      bookOrderShipment(supabase, 'merchant-1', 'nonexistent')
    ).rejects.toThrow(OrderShipmentBookingError);

    await expect(
      bookOrderShipment(supabase, 'merchant-1', 'nonexistent')
    ).rejects.toThrow('Order not found');
  });

  it('throws MISSING_SHIPPING_QUOTE when order has no selected_quote_id', async () => {
    const supabase = createMockSupabase({
      order: {
        data: { ...validOrder, selected_quote_id: null },
        error: null,
      },
    });

    await expect(
      bookOrderShipment(supabase, 'merchant-1', 'order-1')
    ).rejects.toThrow('does not have a saved shipping quote');
  });

  it('throws INVALID_SHIPPING_PROVIDER when provider is not recognized', async () => {
    const supabase = createMockSupabase({
      order: {
        data: { ...validOrder, shipping_provider: 'UNKNOWN_CARRIER' },
        error: null,
      },
    });

    await expect(
      bookOrderShipment(supabase, 'merchant-1', 'order-1')
    ).rejects.toThrow('not configured for provider-backed shipping');
  });

  it('throws MISSING_ORDER_ITEMS when order has no items', async () => {
    const supabase = createMockSupabase({
      order: {
        data: { ...validOrder, order_items: [] },
        error: null,
      },
    });

    await expect(
      bookOrderShipment(supabase, 'merchant-1', 'order-1')
    ).rejects.toThrow('no items');
  });

  it('throws QUOTE_NOT_FOUND when quote does not exist', async () => {
    const supabase = createMockSupabase({
      order: { data: validOrder, error: null },
      quote: { data: null, error: { message: 'not found' } },
    });

    await expect(
      bookOrderShipment(supabase, 'merchant-1', 'order-1')
    ).rejects.toThrow('shipping quote could not be found');
  });

  it('books shipment successfully with valid data', async () => {
    vi.mocked(shippingService.bookShipment).mockResolvedValue(bookingResult);

    const supabase = createMockSupabase({
      order: { data: validOrder, error: null },
      quote: { data: validQuote, error: null },
      merchant: { data: validMerchant, error: null },
      shipmentInsert: { data: { id: 'shipment-1' }, error: null },
    });

    const result = await bookOrderShipment(supabase, 'merchant-1', 'order-1');

    expect(result).toMatchObject({
      shipmentId: 'shipment-1',
      provider: 'TOPSHIP',
      trackingNumber: 'TRK123456',
      carrierName: 'Topship Express',
      quoteId: 'quote-1',
      estimatedDays: 3,
    });

    expect(shippingService.bookShipment).toHaveBeenCalledWith(
      'TOPSHIP',
      expect.objectContaining({
        orderId: 'order-1',
        quoteId: 'quote-1',
        quoteMetadata: validQuote.provider_metadata,
      })
    );
  });

  it('throws MERCHANT_NOT_FOUND when merchant does not exist', async () => {
    const supabase = createMockSupabase({
      order: { data: validOrder, error: null },
      quote: { data: validQuote, error: null },
      merchant: { data: null, error: { message: 'not found' } },
    });

    await expect(
      bookOrderShipment(supabase, 'merchant-1', 'order-1')
    ).rejects.toThrow('Merchant details not found');
  });

  it('throws SHIPMENT_SAVE_FAILED when insert fails', async () => {
    vi.mocked(shippingService.bookShipment).mockResolvedValue(bookingResult);

    const supabase = createMockSupabase({
      order: { data: validOrder, error: null },
      quote: { data: validQuote, error: null },
      merchant: { data: validMerchant, error: null },
      shipmentInsert: { data: null, error: { message: 'insert failed' } },
    });

    await expect(
      bookOrderShipment(supabase, 'merchant-1', 'order-1')
    ).rejects.toThrow('could not be saved locally');
  });
});
