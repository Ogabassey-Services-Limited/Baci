import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingRequest } from '@/lib/shipping/types';

describe('TopshipProvider', () => {
  beforeEach(() => {
    process.env.TOPSHIP_API_KEY = 'test-api-key';
    process.env.TOPSHIP_USE_SANDBOX = 'true';
    process.env.TOPSHIP_SANDBOX_URL = 'https://topship-staging.africa/api';
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.TOPSHIP_API_KEY;
    delete process.env.TOPSHIP_USE_SANDBOX;
    delete process.env.TOPSHIP_SANDBOX_URL;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('logs recoverable state lookup failures as warnings while returning fallback input', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 502 }))
    );
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const { TopshipProvider } = await import('./topship');
    const provider = new TopshipProvider();

    await expect(provider.getStates('NG')).resolves.toEqual([]);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Shipping]',
      expect.objectContaining({
        message: 'Failed to fetch Topship states',
        provider: 'TOPSHIP',
        status: 502,
      })
    );
  });

  it('retries save-shipment with the expected pickup charge and pays with detail.shipmentId', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Invalid Pickup Charge! Expecting NGN 2,150.00',
            path: ['saveShipment'],
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 'shipment-1',
              trackingId: 'T123456789',
              shipmentStatus: 'Draft',
              pricingTier: 'Premium',
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'shipment-1',
            trackingId: 'T123456789',
            shipmentStatus: 'Confirmed',
            isPaid: true,
            pricingTier: 'Premium',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    const { TopshipProvider } = await import('./topship');
    const provider = new TopshipProvider();

    const request: BookingRequest = {
      orderId: 'order-1',
      quoteId: 'quote-1',
      providerRateId: 'Premium_Express Plus Shipping',
      quoteMetadata: {
        pricingTier: 'Premium',
        serviceType: 'Express Plus Shipping',
        cost: 700000,
      },
      sender: {
        name: 'Test Sender',
        email: 'sender@example.com',
        phone: '08012345678',
        address: '12 Adeola Odeku Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      receiver: {
        name: 'Test Receiver',
        email: 'receiver@example.com',
        phone: '08087654321',
        address: '1 Aminu Kano Crescent',
        city: 'Abuja',
        state: 'FCT',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      items: [
        {
          name: 'Test parcel',
          quantity: 1,
          weight: 1,
          value: 5000,
        },
      ],
    };

    const result = await provider.bookShipment(request);

    expect(result).toMatchObject({
      providerShipmentId: 'shipment-1',
      trackingNumber: 'T123456789',
      status: 'booked',
      carrierName: 'Premium Shipping - Express Plus Shipping',
    });

    const firstSaveBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')
    );
    const secondSaveBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body ?? '{}')
    );
    const paymentBody = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );

    expect(firstSaveBody.shipment[0]).toMatchObject({
      shipmentRoute: 'Domestic',
      itemCollectionMode: 'PickUp',
      pricingTier: 'Premium',
      shipmentCharge: 700000,
      pickupCharge: 200000,
      valueAddedTaxCharge: 67500,
    });
    expect(secondSaveBody.shipment[0]).toMatchObject({
      shipmentCharge: 700000,
      pickupCharge: 215000,
      valueAddedTaxCharge: 68625,
    });
    expect(paymentBody).toEqual({
      detail: {
        shipmentId: 'shipment-1',
      },
    });
  });

  it('marks a confirmed payment rejection so callers can safely retry', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 'shipment-1',
              trackingId: 'T123456789',
              shipmentStatus: 'Draft',
              pricingTier: 'Premium',
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: 'Insufficient wallet balance' }),
          {
            status: 402,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    const { TopshipProvider } = await import('./topship');
    const { ShippingBookingRejectedError } = await import('../types');
    const provider = new TopshipProvider();
    const request: BookingRequest = {
      orderId: 'order-1',
      quoteId: 'quote-1',
      providerRateId: 'Premium_Express Plus Shipping',
      quoteMetadata: {
        pricingTier: 'Premium',
        serviceType: 'Express Plus Shipping',
        cost: 700000,
      },
      sender: {
        name: 'Test Sender',
        phone: '08012345678',
        address: '12 Adeola Odeku Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      receiver: {
        name: 'Test Receiver',
        phone: '08087654321',
        address: '1 Aminu Kano Crescent',
        city: 'Abuja',
        state: 'FCT',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      items: [{ name: 'Test parcel', quantity: 1, weight: 1, value: 5000 }],
    };

    await expect(provider.bookShipment(request)).rejects.toBeInstanceOf(
      ShippingBookingRejectedError
    );
  });

  it('logs non-PII diagnostics when Topship returns no quote rates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ status: true, data: [], message: 'no rate' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    );
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const { TopshipProvider } = await import('./topship');
    const provider = new TopshipProvider();

    await expect(
      provider.getQuotes({
        sessionId: 'quote-session-1',
        shipmentType: 'domestic',
        sender: {
          name: 'Sender Name',
          phone: '08012345678',
          address: '12 Private Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
          countryCode: 'NG',
        },
        receiver: {
          name: 'Receiver Name',
          phone: '08087654321',
          address: '1 Private Crescent',
          city: 'Abuja',
          state: 'FCT',
          country: 'Nigeria',
          countryCode: 'NG',
        },
        items: [
          {
            name: 'Phone',
            quantity: 2,
            weight: 0.8,
            value: 500_000,
            category: 'Smartphones',
          },
        ],
      })
    ).resolves.toEqual([]);

    expect(warnSpy).toHaveBeenCalledWith(
      '[Shipping]',
      expect.objectContaining({
        itemCategories: ['smartphones'],
        message: 'No Topship quotes returned',
        provider: 'TOPSHIP',
        receiverCity: 'abuja',
        receiverCountryCode: 'NG',
        receiverState: 'fct',
        responseStatus: true,
        senderCity: 'lagos',
        senderCountryCode: 'NG',
        weightBucket: 'lte_2kg',
      })
    );
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('Private Street');
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('08012345678');
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
      'Private Crescent'
    );
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('08087654321');
  });
});
