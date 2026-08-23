import type { NextRequest } from 'next/server';
import { expect, vi } from 'vitest';

export const domesticSenderShipmentInsertPayloads: unknown[] = [];

export function buildDomesticSenderSupabaseMock(
  quoteOverrides: Record<string, unknown> = {}
) {
  const ordersSelectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        merchant_id: 'merchant-1',
        selected_quote_id: '22222222-2222-4222-8222-222222222222',
        shipping_status: 'pending',
        shipping_address: {
          address: '123 Queen Street West',
          city: 'Toronto',
          state: 'Ontario',
          country: 'Canada',
          countryCode: 'CA',
          postalCode: 'M5V 3L9',
        },
        order_items: [
          {
            name: 'Phone',
            quantity: 1,
            price: 500000,
            product: {
              weight_value: 1,
              weight_unit: 'kg',
              dimensions: { length: 10, width: 8, height: 6, unit: 'cm' },
              commodity_code: '851712',
            },
          },
        ],
      },
      error: null,
    }),
  };
  const quotesSelectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: '22222222-2222-4222-8222-222222222222',
        provider: 'GIGL',
        provider_rate_id: 'gigl:service-centre:5',
        provider_metadata: { stationId: 5 },
        quote_request: null,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        price: 4500,
        currency: 'NGN',
        estimated_days: 2,
        ...quoteOverrides,
      },
      error: null,
    }),
  };
  const shipmentInsertSelectChain = {
    single: vi
      .fn()
      .mockResolvedValue({ data: { id: 'shipment-1' }, error: null }),
  };
  const shipmentInsertChain = {
    select: vi.fn().mockReturnValue(shipmentInsertSelectChain),
  };
  const shippingQuoteUpdateChain = {
    error: null,
    eq: vi.fn(),
  };
  shippingQuoteUpdateChain.eq.mockReturnValue(shippingQuoteUpdateChain);
  const merchantSelectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        business_name: 'Registered Merchant Store',
        business_address: '9 Registered Road, Ikeja, Lagos',
        phone: '+2348012345678',
        registered_address: {
          city: 'Ikeja',
          postal_code: '100001',
          state: 'Lagos',
          street: '9 Registered Road',
        },
        state_code: 'LA',
      },
      error: null,
    }),
  };

  return {
    rpc: vi.fn().mockResolvedValue({
      data: [{ claimed: true, shipment_id: null, tracking_number: null }],
      error: null,
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn(() => ordersSelectChain),
          update: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            select: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'order-1' },
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === 'shipping_quotes') {
        return {
          select: vi.fn((columns: string) => {
            expect(columns).toContain('provider,');
            expect(columns).not.toContain('provider_code');
            return quotesSelectChain;
          }),
          update: vi.fn(() => shippingQuoteUpdateChain),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === 'shipments') {
        return {
          insert: vi.fn((payload: unknown) => {
            domesticSenderShipmentInsertPayloads.push(payload);
            return shipmentInsertChain;
          }),
        };
      }

      if (table === 'merchants') {
        return {
          select: vi.fn(() => merchantSelectChain),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

export function buildDomesticSenderBookingRequest(): NextRequest {
  return new Request('https://usebaci.com/api/shipping/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: '11111111-1111-4111-8111-111111111111',
      carrierId: 'GIGL',
      quoteId: '22222222-2222-4222-8222-222222222222',
      sender: {
        name: 'Merchant Store',
        phone: '+2348011111111',
        address: '1 Merchant Road',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      receiver: {
        name: 'Jane Customer',
        phone: '+2348022222222',
        address: '2 Customer Road',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      items: [
        {
          name: 'Phone',
          quantity: 1,
          weight: 1,
          value: 500000,
        },
      ],
    }),
  }) as unknown as NextRequest;
}
