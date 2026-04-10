import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getMerchantIdForApiUser: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyOrderStatusChange: vi.fn(),
}));

vi.mock('@/lib/order-queries', () => ({
  ORDER_COLUMNS: 'id, shipping_status, shipping_provider, tracking_number',
  ORDER_WITH_ITEMS_QUERY: 'id',
}));

vi.mock('@/lib/shipping/book-order-shipment', () => ({
  bookOrderShipment: vi.fn(),
}));

vi.mock('@/lib/shipping/order-shipment-booking-lock', () => ({
  claimOrderShipmentBooking: vi.fn(),
  clearOrderShipmentBookingLock: vi.fn(),
}));

vi.mock('@/lib/shipping/order-shipment-booking-utils', () => {
  class MockOrderShipmentBookingError extends Error {
    readonly code: string;
    readonly status: number;

    constructor(message: string, status: number, code: string) {
      super(message);
      this.name = 'OrderShipmentBookingError';
      this.status = status;
      this.code = code;
    }
  }

  return {
    isShippingProviderCode: vi.fn(
      (value: string | null | undefined) =>
        value === 'TOPSHIP' || value === 'GIGL' || value === 'SHIIP'
    ),
    OrderShipmentBookingError: MockOrderShipmentBookingError,
  };
});

import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { bookOrderShipment } from '@/lib/shipping/book-order-shipment';
import {
  claimOrderShipmentBooking,
  clearOrderShipmentBookingLock,
} from '@/lib/shipping/order-shipment-booking-lock';
import { OrderShipmentBookingError } from '@/lib/shipping/order-shipment-booking-utils';
import { PATCH } from './route';

type ExistingOrder = {
  id: string;
  order_number: string;
  shipping_status: string;
  payment_status: string;
  is_credit_order: boolean;
  customer_id: string | null;
  selected_quote_id: string | null;
  shipping_provider: string | null;
  tracking_number: string | null;
  shipment_id: string | null;
};

type UpdatedOrder = {
  id: string;
  shipping_status: string;
  shipping_provider: string | null;
  tracking_number: string | null;
};

function createSelectBuilder<T>(result: { data: T | null; error: unknown }) {
  const builder = {
    eq: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
  };

  return builder;
}

function createUpdateBuilder<T>(result: { data: T | null; error: unknown }) {
  const builder = {
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
  };

  return builder;
}

function createSupabaseMock(
  existingOrder: ExistingOrder,
  updatedOrder: UpdatedOrder
) {
  const orderSelectBuilder = createSelectBuilder({
    data: existingOrder,
    error: null,
  });
  const orderUpdateBuilder = createUpdateBuilder({
    data: updatedOrder,
    error: null,
  });

  const ordersSelect = vi.fn(() => orderSelectBuilder);
  const ordersUpdate = vi.fn(() => orderUpdateBuilder);

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: ordersSelect,
          update: ordersUpdate,
        };
      }

      if (table === 'customers') {
        return {
          select: vi.fn(() =>
            createSelectBuilder({
              data: null,
              error: null,
            })
          ),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase: supabase as unknown as SupabaseClient,
    ordersUpdate,
  };
}

function createPatchRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as NextRequest;
}

function createMockUser(): User {
  return {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User;
}

describe('PATCH /api/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: true,
      response: undefined,
    });
    vi.mocked(getMerchantIdForApiUser).mockResolvedValue('merchant-1');
    vi.mocked(claimOrderShipmentBooking).mockResolvedValue({
      status: 'claimed',
      lockToken: 'lock-1',
    });
  });

  it('rejects shipping an order that has not reached processing', async () => {
    const existingOrder: ExistingOrder = {
      id: 'order-1',
      order_number: 'BACI-001',
      shipping_status: 'pending',
      payment_status: 'paid',
      is_credit_order: false,
      customer_id: null,
      selected_quote_id: 'quote-1',
      shipping_provider: 'TOPSHIP',
      tracking_number: null,
      shipment_id: null,
    };
    const { supabase } = createSupabaseMock(existingOrder, {
      id: 'order-1',
      shipping_status: 'shipped',
      shipping_provider: 'TOPSHIP',
      tracking_number: 'TRACK-1',
    });

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });

    const response = await PATCH(
      createPatchRequest({ shipping_status: 'shipped' }),
      {
        params: Promise.resolve({ id: 'order-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: 'Order must be processing before it can be marked as shipped.',
      code: 'ORDER_NOT_READY_TO_SHIP',
    });
    expect(bookOrderShipment).not.toHaveBeenCalled();
  });

  it('rejects provider shipping when the order has no saved quote', async () => {
    const existingOrder: ExistingOrder = {
      id: 'order-1',
      order_number: 'BACI-001',
      shipping_status: 'processing',
      payment_status: 'paid',
      is_credit_order: false,
      customer_id: null,
      selected_quote_id: null,
      shipping_provider: 'TOPSHIP',
      tracking_number: null,
      shipment_id: null,
    };
    const { supabase } = createSupabaseMock(existingOrder, {
      id: 'order-1',
      shipping_status: 'shipped',
      shipping_provider: 'TOPSHIP',
      tracking_number: 'TRACK-1',
    });

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });

    const response = await PATCH(
      createPatchRequest({ shipping_status: 'shipped' }),
      {
        params: Promise.resolve({ id: 'order-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error:
        'This provider order does not have a saved shipping quote. Please re-quote before marking it as shipped.',
      code: 'MISSING_SHIPPING_QUOTE',
    });
    expect(bookOrderShipment).not.toHaveBeenCalled();
  });

  it('books a provider shipment when the order is marked as shipped', async () => {
    const existingOrder: ExistingOrder = {
      id: 'order-1',
      order_number: 'BACI-001',
      shipping_status: 'processing',
      payment_status: 'paid',
      is_credit_order: false,
      customer_id: null,
      selected_quote_id: 'quote-1',
      shipping_provider: 'TOPSHIP',
      tracking_number: null,
      shipment_id: null,
    };
    const updatedOrder: UpdatedOrder = {
      id: 'order-1',
      shipping_status: 'shipped',
      shipping_provider: 'TOPSHIP',
      tracking_number: 'TRACK-1',
    };
    const { supabase, ordersUpdate } = createSupabaseMock(
      existingOrder,
      updatedOrder
    );

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });
    vi.mocked(bookOrderShipment).mockResolvedValue({
      shipmentId: 'shipment-1',
      provider: 'TOPSHIP',
      providerShipmentId: 'provider-shipment-1',
      trackingNumber: 'TRACK-1',
      carrierName: 'Topship',
      quoteId: 'quote-2',
      estimatedDays: 2,
      shipmentStatus: 'booked',
    });

    const response = await PATCH(
      createPatchRequest({ shipping_status: 'shipped' }),
      {
        params: Promise.resolve({ id: 'order-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(claimOrderShipmentBooking).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      'order-1'
    );
    expect(bookOrderShipment).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      'order-1'
    );
    expect(ordersUpdate).toHaveBeenCalledWith({
      selected_quote_id: 'quote-2',
      shipment_id: 'shipment-1',
      shipment_booking_lock_token: null,
      shipment_booking_started_at: null,
      shipping_provider: 'TOPSHIP',
      shipping_status: 'shipped',
      tracking_number: 'TRACK-1',
    });
    expect(payload).toEqual({ order: updatedOrder });
  });

  it('books provider shipment without lock fields when the database lock is unavailable', async () => {
    const existingOrder: ExistingOrder = {
      id: 'order-1',
      order_number: 'BACI-001',
      shipping_status: 'processing',
      payment_status: 'paid',
      is_credit_order: false,
      customer_id: null,
      selected_quote_id: 'quote-1',
      shipping_provider: 'TOPSHIP',
      tracking_number: null,
      shipment_id: null,
    };
    const updatedOrder: UpdatedOrder = {
      id: 'order-1',
      shipping_status: 'shipped',
      shipping_provider: 'TOPSHIP',
      tracking_number: 'TRACK-1',
    };
    const { supabase, ordersUpdate } = createSupabaseMock(
      existingOrder,
      updatedOrder
    );

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });
    vi.mocked(claimOrderShipmentBooking).mockResolvedValue({
      status: 'claimed',
      lockToken: null,
    });
    vi.mocked(bookOrderShipment).mockResolvedValue({
      shipmentId: 'shipment-1',
      provider: 'TOPSHIP',
      providerShipmentId: 'provider-shipment-1',
      trackingNumber: 'TRACK-1',
      carrierName: 'Topship',
      quoteId: 'quote-2',
      estimatedDays: 2,
      shipmentStatus: 'booked',
    });

    const response = await PATCH(
      createPatchRequest({ shipping_status: 'shipped' }),
      {
        params: Promise.resolve({ id: 'order-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(ordersUpdate).toHaveBeenCalledWith({
      selected_quote_id: 'quote-2',
      shipment_id: 'shipment-1',
      shipping_provider: 'TOPSHIP',
      shipping_status: 'shipped',
      tracking_number: 'TRACK-1',
    });
    expect(payload).toEqual({ order: updatedOrder });
  });

  it('returns booking errors without updating the order', async () => {
    const existingOrder: ExistingOrder = {
      id: 'order-1',
      order_number: 'BACI-001',
      shipping_status: 'processing',
      payment_status: 'paid',
      is_credit_order: false,
      customer_id: null,
      selected_quote_id: 'quote-1',
      shipping_provider: 'TOPSHIP',
      tracking_number: null,
      shipment_id: null,
    };
    const updatedOrder: UpdatedOrder = {
      id: 'order-1',
      shipping_status: 'shipped',
      shipping_provider: 'TOPSHIP',
      tracking_number: 'TRACK-1',
    };
    const { supabase, ordersUpdate } = createSupabaseMock(
      existingOrder,
      updatedOrder
    );

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });
    vi.mocked(bookOrderShipment).mockRejectedValue(
      new OrderShipmentBookingError(
        'Quote is already being used for shipping.',
        409,
        'QUOTE_ALREADY_USED'
      )
    );

    const response = await PATCH(
      createPatchRequest({ shipping_status: 'shipped' }),
      {
        params: Promise.resolve({ id: 'order-1' }),
      }
    );
    const payload = await response.json();

    expect(claimOrderShipmentBooking).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      'order-1'
    );
    expect(bookOrderShipment).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      'order-1'
    );
    expect(response.status).toBe(409);
    expect(payload).toEqual({
      error: 'Quote is already being used for shipping.',
      code: 'QUOTE_ALREADY_USED',
    });
    expect(ordersUpdate).not.toHaveBeenCalled();
    expect(clearOrderShipmentBookingLock).not.toHaveBeenCalled();
  });

  it('returns 500 when shipment booking fails unexpectedly', async () => {
    const existingOrder: ExistingOrder = {
      id: 'order-1',
      order_number: 'BACI-001',
      shipping_status: 'processing',
      payment_status: 'paid',
      is_credit_order: false,
      customer_id: null,
      selected_quote_id: 'quote-1',
      shipping_provider: 'TOPSHIP',
      tracking_number: null,
      shipment_id: null,
    };
    const updatedOrder: UpdatedOrder = {
      id: 'order-1',
      shipping_status: 'shipped',
      shipping_provider: 'TOPSHIP',
      tracking_number: 'TRACK-1',
    };
    const { supabase, ordersUpdate } = createSupabaseMock(
      existingOrder,
      updatedOrder
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {
        // Silence expected error logging for this assertion.
      });

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });
    vi.mocked(bookOrderShipment).mockRejectedValue(
      new Error('Topship wallet unavailable')
    );

    const response = await PATCH(
      createPatchRequest({ shipping_status: 'shipped' }),
      {
        params: Promise.resolve({ id: 'order-1' }),
      }
    );
    const payload = await response.json();

    expect(claimOrderShipmentBooking).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      'order-1'
    );
    expect(bookOrderShipment).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      'order-1'
    );
    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: 'Internal server error' });
    expect(ordersUpdate).not.toHaveBeenCalled();
    expect(clearOrderShipmentBookingLock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('returns 409 when another request already owns the shipment booking lock', async () => {
    const existingOrder: ExistingOrder = {
      id: 'order-1',
      order_number: 'BACI-001',
      shipping_status: 'processing',
      payment_status: 'paid',
      is_credit_order: false,
      customer_id: null,
      selected_quote_id: 'quote-1',
      shipping_provider: 'TOPSHIP',
      tracking_number: null,
      shipment_id: null,
    };
    const { supabase, ordersUpdate } = createSupabaseMock(existingOrder, {
      id: 'order-1',
      shipping_status: 'shipped',
      shipping_provider: 'TOPSHIP',
      tracking_number: 'TRACK-1',
    });

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });
    vi.mocked(claimOrderShipmentBooking).mockResolvedValue({
      status: 'in_progress',
    });

    const response = await PATCH(
      createPatchRequest({ shipping_status: 'shipped' }),
      {
        params: Promise.resolve({ id: 'order-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      error: 'Shipment booking is already in progress for this order.',
      code: 'SHIPMENT_BOOKING_IN_PROGRESS',
    });
    expect(bookOrderShipment).not.toHaveBeenCalled();
    expect(ordersUpdate).not.toHaveBeenCalled();
  });

  it('skips provider booking when another request already attached the shipment', async () => {
    const existingOrder: ExistingOrder = {
      id: 'order-1',
      order_number: 'BACI-001',
      shipping_status: 'processing',
      payment_status: 'paid',
      is_credit_order: false,
      customer_id: null,
      selected_quote_id: 'quote-1',
      shipping_provider: 'TOPSHIP',
      tracking_number: null,
      shipment_id: null,
    };
    const updatedOrder: UpdatedOrder = {
      id: 'order-1',
      shipping_status: 'shipped',
      shipping_provider: 'TOPSHIP',
      tracking_number: 'TRACK-1',
    };
    const { supabase, ordersUpdate } = createSupabaseMock(
      existingOrder,
      updatedOrder
    );

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });
    vi.mocked(claimOrderShipmentBooking).mockResolvedValue({
      status: 'already_booked',
    });

    const response = await PATCH(
      createPatchRequest({ shipping_status: 'shipped' }),
      {
        params: Promise.resolve({ id: 'order-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(bookOrderShipment).not.toHaveBeenCalled();
    expect(ordersUpdate).toHaveBeenCalledWith({
      shipping_status: 'shipped',
    });
    expect(payload).toEqual({ order: updatedOrder });
  });

  it('releases the booking lock when shipment booking fails before provider state is created', async () => {
    const existingOrder: ExistingOrder = {
      id: 'order-1',
      order_number: 'BACI-001',
      shipping_status: 'processing',
      payment_status: 'paid',
      is_credit_order: false,
      customer_id: null,
      selected_quote_id: 'quote-1',
      shipping_provider: 'TOPSHIP',
      tracking_number: null,
      shipment_id: null,
    };
    const updatedOrder: UpdatedOrder = {
      id: 'order-1',
      shipping_status: 'shipped',
      shipping_provider: 'TOPSHIP',
      tracking_number: 'TRACK-1',
    };
    const { supabase, ordersUpdate } = createSupabaseMock(
      existingOrder,
      updatedOrder
    );

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });
    vi.mocked(bookOrderShipment).mockRejectedValue(
      new OrderShipmentBookingError(
        'Shipping address is incomplete.',
        400,
        'INCOMPLETE_SHIPPING_ADDRESS'
      )
    );

    const response = await PATCH(
      createPatchRequest({ shipping_status: 'shipped' }),
      {
        params: Promise.resolve({ id: 'order-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: 'Shipping address is incomplete.',
      code: 'INCOMPLETE_SHIPPING_ADDRESS',
    });
    expect(clearOrderShipmentBookingLock).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      'order-1',
      'lock-1'
    );
    expect(ordersUpdate).not.toHaveBeenCalled();
  });
});
