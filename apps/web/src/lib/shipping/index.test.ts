import { afterEach, describe, expect, it, vi } from 'vitest';

async function importShippingService() {
  vi.resetModules();
  return await import('./index');
}

const quoteRequest = {
  sessionId: 'session-1',
  shipmentType: 'domestic' as const,
  receiver: {
    name: 'Customer',
    phone: '+2348000000001',
    address: '1 Customer Street',
    city: 'Abuja',
    state: 'FCT',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  items: [
    {
      name: 'Phone',
      quantity: 1,
      weight: 1,
      value: 50000,
    },
  ],
};

const bookingRequest = {
  orderId: 'order-1',
  quoteId: 'quote-1',
  sender: {
    name: 'Merchant',
    phone: '+2348000000000',
    address: '1 Merchant Street',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  receiver: quoteRequest.receiver,
  items: quoteRequest.items,
};

function stubGiglRuntimeEnv() {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('GIGL_BASE_URL', 'https://thirdpartynode.example.test');
  vi.stubEnv('GIGL_EMAIL', 'shipper@example.com');
  vi.stubEnv('GIGL_PASSWORD', 'secret');
}

function mockShippingProviders() {
  const giglGetQuotes = vi.fn(async () => [
    {
      id: 'gigl-quote-1',
      provider: 'GIGL' as const,
      serviceTier: 'Standard',
      carrierName: 'GIG Logistics',
      displayName: 'GIG Logistics',
      estimatedDays: 3,
      price: 5000,
      currency: 'NGN',
      pickupIncluded: true,
      insuranceIncluded: true,
      expiresAt: new Date(Date.now() + 60_000),
    },
  ]);
  const topshipGetQuotes = vi.fn(() =>
    Promise.reject(new Error('Topship should be silent when disabled'))
  );
  const topshipBookShipment = vi.fn(() =>
    Promise.reject(
      new Error('Topship booking should be disabled before provider call')
    )
  );
  const topshipCancelShipment = vi.fn(async () => ({
    success: true,
    message: 'cancelled',
  }));
  const giglTrackShipment = vi.fn(() =>
    Promise.reject(new Error('GIGL did not find shipment'))
  );
  const topshipTrackShipment = vi.fn(async () => ({
    provider: 'TOPSHIP' as const,
    trackingNumber: 'TS-123',
    status: 'in_transit' as const,
    carrierName: 'Topship',
    events: [],
  }));

  vi.doMock('./providers/gigl', () => ({
    GiglProvider: class {
      readonly code = 'GIGL' as const;
      readonly name = 'GIGL';
      readonly displayName = 'GIG Logistics';
      readonly supportsDomestic = true;
      readonly supportsInternational = true;
      getQuotes = giglGetQuotes;
      bookShipment = vi.fn();
      trackShipment = giglTrackShipment;
      cancelShipment = vi.fn();
      isAvailable = vi.fn(async () => true);
    },
  }));

  vi.doMock('./providers/topship', () => ({
    TopshipProvider: class {
      readonly code = 'TOPSHIP' as const;
      readonly name = 'Topship';
      readonly displayName = 'Topship';
      readonly supportsDomestic = true;
      readonly supportsInternational = true;
      getQuotes = topshipGetQuotes;
      bookShipment = topshipBookShipment;
      trackShipment = topshipTrackShipment;
      cancelShipment = topshipCancelShipment;
      isAvailable = vi.fn(async () => true);
    },
  }));

  return {
    giglTrackShipment,
    topshipBookShipment,
    topshipCancelShipment,
    topshipGetQuotes,
    topshipTrackShipment,
  };
}

describe('shippingService', () => {
  afterEach(() => {
    vi.doUnmock('./providers/gigl');
    vi.doUnmock('./providers/topship');
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not register GIGL in production when runtime configuration is incomplete', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GIGL_BASE_URL', '');
    vi.stubEnv('GIGL_EMAIL', 'shipper@example.com');
    vi.stubEnv('GIGL_PASSWORD', 'secret');

    const { shippingService } = await importShippingService();

    expect(shippingService.getEnabledProviders()).not.toContain('GIGL');
    expect(shippingService.getEnabledProviders()).toContain('TOPSHIP');
  });

  it('registers GIGL in production when all runtime configuration is present', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GIGL_BASE_URL', 'https://thirdparty.example.test');
    vi.stubEnv('GIGL_EMAIL', 'shipper@example.com');
    vi.stubEnv('GIGL_PASSWORD', 'secret');

    const { shippingService } = await importShippingService();

    expect(shippingService.getEnabledProviders()).toEqual(
      expect.arrayContaining(['GIGL', 'TOPSHIP'])
    );
  });

  it('registers GIGL as an enabled shipping provider', async () => {
    vi.stubEnv('GIGL_BASE_URL', 'https://thirdparty.example.test');
    vi.stubEnv('GIGL_EMAIL', 'shipper@example.com');
    vi.stubEnv('GIGL_PASSWORD', 'secret');

    const { shippingService } = await importShippingService();

    expect(shippingService.getEnabledProviders()).toEqual(
      expect.arrayContaining(['GIGL', 'TOPSHIP'])
    );
  });

  it('does not register GIGL when the provider kill switch is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GIGL_ENABLED', 'false');
    vi.stubEnv('GIGL_BASE_URL', 'https://thirdpartynode.theagilitysystems.com');
    vi.stubEnv('GIGL_EMAIL', 'shipper@example.com');
    vi.stubEnv('GIGL_PASSWORD', 'secret');

    const { shippingService } = await importShippingService();

    expect(shippingService.getEnabledProviders()).not.toContain('GIGL');
    expect(shippingService.getEnabledProviders()).toContain('TOPSHIP');
  });

  it('silently skips Topship for new quote aggregation when disabled', async () => {
    stubGiglRuntimeEnv();
    vi.stubEnv('TOPSHIP_API_KEY', 'topship-secret');
    vi.stubEnv('TOPSHIP_ENABLED', 'false');
    const { topshipGetQuotes } = mockShippingProviders();

    const { shippingService } = await importShippingService();

    expect(shippingService.getEnabledProviders()).toEqual(['GIGL']);

    const response = await shippingService.getQuotes(quoteRequest);

    expect(topshipGetQuotes).not.toHaveBeenCalled();
    expect(response.warnings).toBeUndefined();
    expect(response.quotes.all).toHaveLength(1);
    expect(response.quotes.all[0].provider).toBe('GIGL');
  });

  it('returns an explicit warning when no quote providers are registered', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GIGL_ENABLED', 'false');
    vi.stubEnv('TOPSHIP_ENABLED', 'false');
    mockShippingProviders();

    const { shippingService } = await importShippingService();

    expect(shippingService.getEnabledProviders()).toEqual([]);

    const response = await shippingService.getQuotes(quoteRequest);

    expect(response.quotes.all).toHaveLength(0);
    expect(response.warnings).toEqual([
      'No shipping providers are currently enabled',
    ]);
  });

  it('blocks new Topship bookings when Topship is disabled', async () => {
    stubGiglRuntimeEnv();
    vi.stubEnv('TOPSHIP_API_KEY', 'topship-secret');
    vi.stubEnv('TOPSHIP_ENABLED', 'false');
    const { topshipBookShipment } = mockShippingProviders();

    const { shippingService } = await importShippingService();

    await expect(
      shippingService.bookShipment('TOPSHIP', bookingRequest)
    ).rejects.toMatchObject({
      code: 'SHIPPING_PROVIDER_DISABLED',
      message: 'Provider TOPSHIP is disabled for new shipments',
      status: 400,
    });
    expect(topshipBookShipment).not.toHaveBeenCalled();
  });

  it('blocks direct Topship quotes when Topship is disabled', async () => {
    stubGiglRuntimeEnv();
    vi.stubEnv('TOPSHIP_API_KEY', 'topship-secret');
    vi.stubEnv('TOPSHIP_ENABLED', 'false');
    const { topshipGetQuotes } = mockShippingProviders();

    const { shippingService } = await importShippingService();

    await expect(
      shippingService.getProviderQuotes('TOPSHIP', quoteRequest)
    ).rejects.toMatchObject({
      code: 'SHIPPING_PROVIDER_DISABLED',
      message: 'Provider TOPSHIP is disabled for new shipments',
      status: 400,
    });
    expect(topshipGetQuotes).not.toHaveBeenCalled();
  });

  it('keeps existing Topship operations available when Topship is disabled for new shipments', async () => {
    stubGiglRuntimeEnv();
    vi.stubEnv('TOPSHIP_API_KEY', 'topship-secret');
    vi.stubEnv('TOPSHIP_ENABLED', 'false');
    const { topshipCancelShipment, topshipTrackShipment } =
      mockShippingProviders();

    const { shippingService } = await importShippingService();

    await expect(
      shippingService.trackShipment('TS-123', 'TOPSHIP')
    ).resolves.toMatchObject({
      provider: 'TOPSHIP',
      trackingNumber: 'TS-123',
    });
    expect(topshipTrackShipment).toHaveBeenCalledWith('TS-123');
    await expect(
      shippingService.cancelShipment('TOPSHIP', 'ship-123')
    ).resolves.toMatchObject({ success: true });
    expect(topshipCancelShipment).toHaveBeenCalledWith('ship-123');
  });

  it('keeps providerless tracking fallback available for disabled Topship waybills', async () => {
    stubGiglRuntimeEnv();
    vi.stubEnv('TOPSHIP_API_KEY', 'topship-secret');
    vi.stubEnv('TOPSHIP_ENABLED', 'false');
    const { giglTrackShipment, topshipTrackShipment } = mockShippingProviders();

    const { shippingService } = await importShippingService();

    await expect(
      shippingService.trackShipment('TS-123')
    ).resolves.toMatchObject({
      provider: 'TOPSHIP',
      trackingNumber: 'TS-123',
    });
    expect(giglTrackShipment).toHaveBeenCalledWith('TS-123');
    expect(topshipTrackShipment).toHaveBeenCalledWith('TS-123');
  });

  it('throws when booking against an unavailable provider code', async () => {
    const { shippingService } = await importShippingService();

    await expect(
      shippingService.bookShipment('MISSING' as never, bookingRequest)
    ).rejects.toThrow('Provider MISSING not found');
  });
});
