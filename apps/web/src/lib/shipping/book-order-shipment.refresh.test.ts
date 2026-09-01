import { beforeEach, describe, expect, it, vi } from 'vitest';

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
        name: 'Customer',
        phone: '08000000001',
        address: 'Receiver Road',
        city: 'Abuja',
        state: 'Abuja',
        country: 'Nigeria',
        countryCode: 'NG',
      }),
      toShipmentItems: vi
        .fn()
        .mockReturnValue([
          { name: 'Widget', quantity: 1, weight: 1, value: 5000 },
        ]),
    };
  }
);

const { bookOrderShipment } = await import('./book-order-shipment');
const { shippingService } = await import('@/lib/shipping');

const staleSender = {
  name: 'Ogabassey',
  phone: '08000000000',
  address: '2 Olaide Tomori Street, Ikeja, 100001',
  city: 'Ikeja',
  state: '100001',
  country: 'Nigeria',
  countryCode: 'NG',
};

const mismatchedCallerSender = {
  name: 'Ogabassey',
  phone: '08000000000',
  address: '2 Olaide Tomori Street, Ikeja, Lagos, 100001',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};

const correctedSender = {
  name: 'Ogabassey',
  phone: '08000000000',
  address: '2 Olaide Tomori Street, Ikeja, 100001',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
  postalCode: '100001',
};

type StoredSender = typeof staleSender | typeof correctedSender;

function stubShippingService() {
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
      rawResponse: {},
    },
  ]);
  vi.mocked(shippingService.bookShipment).mockResolvedValue({
    provider: 'GIGL',
    providerShipmentId: 'waybill-1',
    trackingNumber: 'waybill-1',
    carrierName: 'GIG Logistics',
    status: 'booked',
    rawResponse: {},
  });
}

function createSupabase({
  upsertError = null,
  quoteExpiresAt = new Date(Date.now() - 60_000).toISOString(),
  storedSender = staleSender,
  fundingSource,
}: {
  upsertError?: { message: string } | null;
  quoteExpiresAt?: string;
  storedSender?: StoredSender;
  fundingSource?: 'customer_checkout' | 'merchant_wallet' | null;
} = {}) {
  const order = {
    id: 'order-1',
    customer_name: 'Customer',
    customer_email: 'customer@example.com',
    customer_phone: '08000000001',
    shipping_fee: 2500,
    selected_quote_id: 'quote-1',
    shipping_provider: 'GIGL',
    shipping_funding_source: fundingSource,
    shipping_address: {
      address: 'Receiver Road',
      city: 'Abuja',
      state: 'Abuja',
      phone: '08000000001',
    },
    order_items: [{ name: 'Widget', quantity: 1, price: 5000 }],
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
    expires_at: quoteExpiresAt,
    quote_request: {
      sessionId: 'session-1',
      shipmentType: 'domestic',
      sender: storedSender,
      receiver: {
        ...order.shipping_address,
        name: order.customer_name,
        phone: order.customer_phone,
        country: 'Nigeria',
        countryCode: 'NG',
      },
      items: [{ name: 'Widget', quantity: 1, weight: 1, value: 5000 }],
    },
    provider_metadata: {},
  };

  const orderSelect = {
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
    single: vi.fn().mockResolvedValue({ data: quote, error: null }),
  };
  const merchantSelect = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        business_name: 'Ogabassey',
        business_address: '2 Olaide Tomori Street, Ikeja, 100001',
        phone: '08000000000',
        registered_address: {
          city: 'Ikeja',
          postal_code: '100001',
          state: null,
          street: '2 Olaide Tomori Street',
        },
        state_code: 'LA',
      },
      error: null,
    }),
  };
  const update = { error: null, eq: vi.fn().mockReturnThis() };
  const insertSelect = {
    single: vi
      .fn()
      .mockResolvedValue({ data: { id: 'shipment-1' }, error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'orders') return { select: vi.fn(() => orderSelect) };
      if (table === 'shipments') {
        return {
          select: vi.fn(() => existingShipmentSelect),
          insert: vi.fn(() => ({ select: vi.fn(() => insertSelect) })),
        };
      }
      if (table === 'shipping_quotes') {
        return {
          select: vi.fn(() => quoteSelect),
          update: vi.fn(() => update),
          upsert: vi.fn().mockResolvedValue({ error: upsertError }),
        };
      }
      if (table === 'merchants') return { select: vi.fn(() => merchantSelect) };
      throw new Error(`Unexpected table ${table}`);
    }),
  } as never;
}

describe('bugfix: expired domestic quote refresh sender', () => {
  beforeEach(() => {
    stubShippingService();
  });

  it('refreshes expired domestic quotes with the server-resolved merchant sender', async () => {
    await bookOrderShipment(createSupabase(), 'merchant-1', 'order-1');

    expect(shippingService.getProviderQuotes).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({
        shipmentType: 'domestic',
        sender: correctedSender,
      })
    );
    expect(shippingService.bookShipment).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({ sender: correctedSender })
    );
  });

  it('does not book when persisting the refreshed quote fails', async () => {
    await expect(
      bookOrderShipment(
        createSupabase({ upsertError: { message: 'upsert failed' } }),
        'merchant-1',
        'order-1'
      )
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'QUOTE_REFRESH_PERSIST_FAILED',
        status: 500,
      })
    );

    expect(shippingService.getProviderQuotes).toHaveBeenCalled();
    expect(shippingService.bookShipment).not.toHaveBeenCalled();
  });

  it('requires wallet quote reconfirmation instead of refreshing an expired quote', async () => {
    await expect(
      bookOrderShipment(
        createSupabase({ fundingSource: 'merchant_wallet' }),
        'merchant-1',
        'order-1'
      )
    ).rejects.toMatchObject({
      code: 'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED',
      status: 409,
    });

    expect(shippingService.getProviderQuotes).not.toHaveBeenCalled();
    expect(shippingService.bookShipment).not.toHaveBeenCalled();
  });
});

describe('bugfix: unexpired domestic quote sender mismatch', () => {
  beforeEach(() => {
    stubShippingService();
  });

  it('refreshes an unexpired quote when the stored sender differs from the registered merchant origin', async () => {
    await bookOrderShipment(
      createSupabase({
        quoteExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        storedSender: mismatchedCallerSender,
      }),
      'merchant-1',
      'order-1'
    );

    expect(shippingService.getProviderQuotes).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({
        shipmentType: 'domestic',
        sender: correctedSender,
      })
    );
    expect(shippingService.bookShipment).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({ sender: correctedSender })
    );
  });

  it('does not refresh an unexpired quote when the stored sender already matches', async () => {
    await bookOrderShipment(
      createSupabase({
        quoteExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        storedSender: correctedSender,
      }),
      'merchant-1',
      'order-1'
    );

    expect(shippingService.getProviderQuotes).not.toHaveBeenCalled();
    expect(shippingService.bookShipment).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({ sender: correctedSender })
    );
  });

  it('books the original quote normally when a wallet quote is still fresh', async () => {
    await bookOrderShipment(
      createSupabase({
        quoteExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        storedSender: correctedSender,
        fundingSource: 'merchant_wallet',
      }),
      'merchant-1',
      'order-1'
    );

    expect(shippingService.getProviderQuotes).not.toHaveBeenCalled();
    expect(shippingService.bookShipment).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({ quoteId: 'quote-1' })
    );
  });

  it('requires wallet quote reconfirmation instead of refreshing a changed sender', async () => {
    await expect(
      bookOrderShipment(
        createSupabase({
          quoteExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          storedSender: mismatchedCallerSender,
          fundingSource: 'merchant_wallet',
        }),
        'merchant-1',
        'order-1'
      )
    ).rejects.toMatchObject({
      code: 'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED',
      status: 409,
    });

    expect(shippingService.getProviderQuotes).not.toHaveBeenCalled();
    expect(shippingService.bookShipment).not.toHaveBeenCalled();
  });
});
