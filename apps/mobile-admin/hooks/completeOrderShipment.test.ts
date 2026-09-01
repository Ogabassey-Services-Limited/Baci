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
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
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
        fulfillmentDetails: { imei: '', items: [], serialNumber: '' },
        handleSaveRider: vi.fn(),
        mode: 'provider',
        merchantId: 'merchant-1',
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

  it('validates provider availability before persisting fulfillment details', async () => {
    await expect(
      completeOrderShipment({
        fulfillmentDetails: { imei: '123', items: [], serialNumber: '' },
        handleSaveRider: vi.fn(),
        mode: 'provider',
        merchantId: 'merchant-1',
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
        saveDetails: true,
        updateStatus: vi.fn(),
      })
    ).rejects.toThrow(
      'This order does not have a saved provider quote to book against.'
    );

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('invalidates the merchant wallet after an already-funded provider booking', async () => {
    const updateStatus = vi.fn().mockResolvedValue({});
    await completeOrderShipment({
      fulfillmentDetails: { imei: '', items: [], serialNumber: '' },
      handleSaveRider: vi.fn(),
      mode: 'provider',
      merchantId: 'merchant-1',
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
      providerBookingAvailable: true,
      providerLabel: 'GIG Logistics',
      queryClient: {
        invalidateQueries: mocks.invalidateQueries,
      } as unknown as QueryClient,
      riderPhone: '',
      saveDetails: false,
      updateStatus,
    });

    expect(updateStatus).toHaveBeenCalledWith({
      orderId: 'order-1',
      status: 'shipped',
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(5, {
      queryKey: ['merchant-wallet'],
    });
  });

  it('self-fulfills, persists rider details, and invalidates order queries', async () => {
    const handleSaveRider = vi.fn();

    const result = await completeOrderShipment({
      fulfillmentDetails: { imei: '', items: [], serialNumber: '' },
      handleSaveRider,
      mode: 'self_fulfillment',
      merchantId: 'merchant-1',
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
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['order', 'order-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['orders'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['order-counts'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(4, {
      queryKey: ['dashboard-stats'],
    });
    expect(result.title).toBe('Order Shipped');
    expect(result.message).toContain('notification has been queued');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://example.com/api/shipping/self-fulfill',
      expect.any(Object)
    );
    // With a rider phone, the success modal offers the "Send to Rider" action.
    expect(result.showAction).toBe(true);
    expect(result.actionLabel).toBe('Send Order Details to Rider');
  });

  it('self-fulfills without rider details when the rider phone is omitted', async () => {
    const handleSaveRider = vi.fn();

    const result = await completeOrderShipment({
      fulfillmentDetails: { imei: '123', items: [], serialNumber: '' },
      handleSaveRider,
      mode: 'self_fulfillment',
      merchantId: 'merchant-1',
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
      riderPhone: '+234',
      saveDetails: true,
      updateStatus: vi.fn(),
    });

    const selfFulfillmentCall = mocks.fetch.mock.calls.find(([url]) =>
      String(url).includes('/api/shipping/self-fulfill')
    );
    const selfFulfillmentBody = JSON.parse(
      String(selfFulfillmentCall?.[1]?.body)
    ) as Record<string, unknown>;

    // Empty rider phone does not block shipment; fulfillment details still save.
    expect(selfFulfillmentBody).not.toHaveProperty('dispatchPhone');
    expect(result.title).toBe('Order Shipped');
    expect(mocks.update).toHaveBeenCalled();
    expect(handleSaveRider).not.toHaveBeenCalled();
    // Without a rider phone, the success modal hides the "Send to Rider" action.
    expect(result.showAction).toBe(false);
    expect(result.actionLabel).toBe('');
  });

  it('validates a partial rider phone before persisting fulfillment details', async () => {
    await expect(
      completeOrderShipment({
        fulfillmentDetails: { imei: '123', items: [], serialNumber: '' },
        handleSaveRider: vi.fn(),
        mode: 'self_fulfillment',
        merchantId: 'merchant-1',
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
        riderPhone: '0803',
        saveDetails: true,
        updateStatus: vi.fn(),
      })
    ).rejects.toThrow('Rider phone number is not valid for WhatsApp.');

    expect(mocks.update).not.toHaveBeenCalled();
  });
});
