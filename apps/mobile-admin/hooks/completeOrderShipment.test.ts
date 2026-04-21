import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
  invalidateQueries: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    from: () => ({
      update: mocks.update,
    }),
  },
}));

vi.mock('@/lib/api-client', () => ({
  BASE_URL: 'https://example.com',
}));

import { completeOrderShipment } from './completeOrderShipment';

describe('completeOrderShipment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
    mocks.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mocks.fetch.mockResolvedValue({
      json: async () => ({}),
      ok: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects provider shipment when the order has no provider booking', async () => {
    await expect(
      completeOrderShipment({
        fulfillmentDetails: { imei: '', serialNumber: '' },
        handleSaveRider: vi.fn(),
        merchantId: 'merchant-1',
        mode: 'provider',
        order: {
          id: 'order-1',
          amount_paid: 0,
          balance: 0,
          created_at: '',
          customer_email: 'customer@example.com',
          customer_name: 'Ada',
          customer_phone: null,
          discount_amount: 0,
          order_number: 'ORD-1',
          payment_status: 'pending',
          shipping_address: null,
          shipping_status: 'processing',
          total: 10000,
          updated_at: '',
        },
        providerBookingAvailable: false,
        providerLabel: 'GIGL',
        queryClient: {
          invalidateQueries: mocks.invalidateQueries,
        } as unknown as QueryClient,
        riderPhone: '',
        saveDetails: false,
        updateStatus: vi.fn(),
      })
    ).rejects.toThrow(
      'This order does not have a saved provider quote to book against.'
    );
  });

  it('self-fulfills, persists rider details, and invalidates order queries', async () => {
    const handleSaveRider = vi.fn();

    const result = await completeOrderShipment({
      fulfillmentDetails: { imei: '', serialNumber: '' },
      handleSaveRider,
      merchantId: 'merchant-1',
      mode: 'self_fulfillment',
      order: {
        id: 'order-1',
        amount_paid: 0,
        balance: 0,
        created_at: '',
        customer_email: 'customer@example.com',
        customer_name: 'Ada',
        customer_phone: '08030000000',
        discount_amount: 0,
        order_number: 'ORD-1',
        payment_status: 'pending',
        shipping_address: null,
        shipping_status: 'processing',
        total: 10000,
        updated_at: '',
      },
      providerBookingAvailable: true,
      providerLabel: 'GIGL',
      queryClient: {
        invalidateQueries: mocks.invalidateQueries,
      } as unknown as QueryClient,
      riderPhone: '08034444444',
      saveDetails: false,
      updateStatus: vi.fn(),
    });

    expect(handleSaveRider).toHaveBeenCalledWith('08034444444');
    expect(mocks.invalidateQueries).toHaveBeenCalled();
    expect(result.title).toBe('Order Shipped');
  });
});
