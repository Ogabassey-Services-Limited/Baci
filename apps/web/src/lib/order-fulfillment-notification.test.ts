import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/email-templates', () => ({
  generateOrderDeliveredEmail: vi.fn(() => '<html>delivered</html>'),
  generateOrderDeliveredText: vi.fn(() => 'delivered text'),
  generateOrderShippedEmail: vi.fn(() => '<html>shipped</html>'),
  generateOrderShippedText: vi.fn(() => 'shipped text'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/order-queries', () => ({
  ORDER_WITH_ITEMS_QUERY: 'mock-order-with-items-query',
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: vi.fn(),
}));

import {
  generateOrderDeliveredEmail,
  generateOrderShippedEmail,
} from '@/lib/email-templates';
import { sendEmail } from '@/lib/zeptomail';
import { sendOrderFulfillmentNotification } from './order-fulfillment-notification';

const merchant = {
  id: 'merchant-1',
  business_name: 'Test Store',
  slug: 'test-store',
  support_email: 'support@test-store.com',
  email_sender_name: null,
  email: 'merchant@test-store.com',
  tax_identification_number: null,
  cac_rc_number: null,
};

const baseOrder = {
  id: 'order-1',
  customer_id: 'customer-1',
  order_number: 'ORD-001',
  customer_name: 'Jane Doe' as string | null,
  customer_email: 'jane@example.com' as string | null,
  customer_phone: '08012345678',
  shipping_status: 'shipped',
  shipping_provider: 'TOPSHIP',
  tracking_number: 'T222600389',
  tracking_token: 'track-token-123',
  shipping_address: {
    address: '1 Test Street',
    city: 'Lagos',
    state: 'Lagos',
  },
  order_items: [{ name: 'Test parcel', quantity: 1 }],
};

function createSelectBuilder<T>(result: { data: T; error: unknown }) {
  const builder = {
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
  };

  return builder;
}

function createSupabaseMock({
  order = baseOrder,
  settings = { google_place_id: 'place-1' },
}: {
  order?: typeof baseOrder;
  settings?: { google_place_id: string | null };
} = {}) {
  const merchantBuilder = createSelectBuilder({ data: merchant, error: null });
  const orderBuilder = createSelectBuilder({ data: order, error: null });
  const settingsBuilder = createSelectBuilder({ data: settings, error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === 'merchants') return merchantBuilder;
      if (table === 'orders') return orderBuilder;
      if (table === 'merchant_feature_settings') return settingsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as SupabaseClient;
}

describe('sendOrderFulfillmentNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'usebaci.com');
    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-1',
    });
  });

  it('sends shipped email from persisted order data without blocking on request-side state', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock(),
    });

    expect(result).toMatchObject({ status: 'sent', messageId: 'msg-1' });
    expect(generateOrderShippedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        courierName: 'TOPSHIP',
        trackingNumber: 'T222600389',
        trackingUrl:
          'https://test-store.usebaci.com/track-order?token=track-token-123',
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        auditContext: expect.objectContaining({
          metadata: { trigger: 'order_shipped_notification' },
        }),
        to: 'jane@example.com',
      })
    );
  });

  it('skips legacy shipped orders without a valid customer email', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, customer_email: null },
      }),
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'missing_customer_email',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends delivered email with merchant Google review context', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_delivered',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, shipping_status: 'delivered' },
      }),
    });

    expect(result).toMatchObject({
      hasGoogleRating: true,
      messageId: 'msg-1',
      status: 'sent',
    });
    expect(generateOrderDeliveredEmail).toHaveBeenCalledWith(
      expect.objectContaining({ googlePlaceId: 'place-1' })
    );
  });

  it('treats completed orders as delivered for fulfillment notifications', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_delivered',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, shipping_status: 'completed' },
      }),
    });

    expect(result).toMatchObject({
      messageId: 'msg-1',
      status: 'sent',
    });
    expect(generateOrderDeliveredEmail).toHaveBeenCalledWith(
      expect.objectContaining({ googlePlaceId: 'place-1' })
    );
  });

  it('sends historical shipped outbox events after the order advances to delivered', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, shipping_status: 'delivered' },
      }),
    });

    expect(result).toMatchObject({ status: 'sent', messageId: 'msg-1' });
    expect(generateOrderShippedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        courierName: 'TOPSHIP',
        trackingNumber: 'T222600389',
      })
    );
  });

  it('uses a safe customer-name fallback for legacy nullable orders', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, customer_name: null },
      }),
    });

    expect(result).toMatchObject({ status: 'sent' });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ toName: 'Customer' })
    );
  });

  it('sends historical shipped outbox events after the order advances to out for delivery', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, shipping_status: 'out_for_delivery' },
      }),
    });

    expect(result).toMatchObject({ status: 'sent', messageId: 'msg-1' });
    expect(generateOrderShippedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        courierName: 'TOPSHIP',
        trackingNumber: 'T222600389',
      })
    );
  });

  it('keeps manual shipped sends strict when the order already advanced', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      mismatchBehavior: 'invalid_state',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, shipping_status: 'delivered' },
      }),
    });

    expect(result).toEqual({
      status: 'invalid_state',
      error: 'Order must be marked as shipped first',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not send when the order no longer matches the queued event state', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, shipping_status: 'returned' },
      }),
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'order_not_in_required_status',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('treats a failed shipment as a valid but non-sendable order state', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, shipping_status: 'failed' },
      }),
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'order_not_in_required_status',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns not_found when the merchant lookup is missing', async () => {
    const supabase = createSupabaseMock();
    const fromMock = supabase.from as unknown as {
      mockImplementation: (impl: (table: string) => unknown) => void;
    };
    fromMock.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return createSelectBuilder({
          data: null,
          error: { message: 'missing' },
        });
      }
      if (table === 'orders') {
        return createSelectBuilder({ data: baseOrder, error: null });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase,
    });

    expect(result).toEqual({
      status: 'not_found',
      error: 'Order or merchant not found',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns failed when merchant payload validation fails', async () => {
    const supabase = createSupabaseMock();
    const fromMock = supabase.from as unknown as {
      mockImplementation: (impl: (table: string) => unknown) => void;
    };
    fromMock.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return createSelectBuilder({
          data: { ...merchant, slug: null },
          error: null,
        });
      }
      if (table === 'orders') {
        return createSelectBuilder({ data: baseOrder, error: null });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase,
    });

    expect(result).toEqual({
      status: 'failed',
      error: 'Invalid merchant payload',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns failed when order payload validation fails', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, id: '' },
      }),
    });

    expect(result).toEqual({
      status: 'failed',
      error: 'Invalid order payload',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns invalid_state for direct route callers that require HTTP 400 semantics', async () => {
    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      mismatchBehavior: 'invalid_state',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        order: { ...baseOrder, shipping_status: 'delivered' },
      }),
    });

    expect(result).toEqual({
      status: 'invalid_state',
      error: 'Order must be marked as shipped first',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
