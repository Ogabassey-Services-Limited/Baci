import { describe, expect, it, vi } from 'vitest';
import { persistBookedShipment } from './persist-booked-shipment';

describe('persistBookedShipment', () => {
  it('returns a 500 payload when the shipment insert fails', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'insert failed' },
            }),
          }),
        }),
      }),
    };

    const result = await persistBookedShipment({
      supabase: supabase as never,
      orderId: 'order-1',
      merchantId: 'merchant-1',
      senderInfo: {
        name: 'Merchant',
        phone: '0800',
        address: '1 Road',
        city: 'Ikeja',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      receiver: {
        name: 'Customer',
        phone: '0801',
        address: '2 Road',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100 }],
      bookingQuote: {
        id: 'quote-1',
        merchant_id: 'merchant-1',
        provider: 'GIGL',
        service_tier: 'GoStandard',
        carrier_name: 'GIG Logistics',
        price: 2500,
        currency: 'NGN',
        estimated_days: 2,
        provider_rate_id: 'GIGL_1',
        expires_at: new Date().toISOString(),
        quote_request: {},
        provider_metadata: {},
      },
      result: {
        provider: 'GIGL',
        providerShipmentId: 'waybill-1',
        trackingNumber: 'waybill-1',
        carrierName: 'GIG Logistics',
        status: 'booked',
        rawResponse: {},
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      trackingNumber: 'waybill-1',
      error: expect.stringContaining('waybill-1'),
    });
  });
});
