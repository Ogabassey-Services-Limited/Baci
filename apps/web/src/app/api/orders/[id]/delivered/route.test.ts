import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getMerchantIdForApiUser: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/email-templates', () => ({
  generateOrderDeliveredEmail: vi.fn(() => '<html>delivered</html>'),
  generateOrderDeliveredText: vi.fn(() => 'delivered text'),
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
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import {
  generateOrderDeliveredEmail,
  generateOrderDeliveredText,
} from '@/lib/email-templates';
import { sendEmail } from '@/lib/zeptomail';
import { POST } from './route';

const orderId = 'aaffdc6b-f171-4e65-86a4-b379fd3d1757';

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

const featureSettings = {
  google_place_id: 'place-1',
};

const deliveredOrder = {
  id: orderId,
  customer_id: 'customer-1',
  order_number: 'ORD-001',
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com' as string | null,
  shipping_status: 'delivered',
  order_items: [{ name: 'Test parcel', quantity: 1 }],
};

function createMockUser(): User {
  return {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function createSelectBuilder<T>(result: { data: T; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
  };

  return builder;
}

function createSupabaseMock(order = deliveredOrder) {
  const merchantBuilder = createSelectBuilder({ data: merchant, error: null });
  const settingsBuilder = createSelectBuilder({
    data: featureSettings,
    error: null,
  });
  const orderBuilder = createSelectBuilder({ data: order, error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return merchantBuilder;
      }
      if (table === 'merchant_feature_settings') {
        return settingsBuilder;
      }
      if (table === 'orders') {
        return orderBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
  } as unknown as SupabaseClient;
}

function createRequest() {
  return new NextRequest(`http://localhost/api/orders/${orderId}/delivered`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token',
    },
  });
}

describe('POST /api/orders/[id]/delivered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'usebaci.com');
    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-1',
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase: createSupabaseMock(),
    });
    vi.mocked(getMerchantIdForApiUser).mockResolvedValue('merchant-1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends delivered email when the order has a valid customer email', async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: orderId }),
    });

    expect(response.status).toBe(200);
    expect(generateOrderDeliveredEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: 'ORD-001',
        customerName: 'Jane Doe',
        googlePlaceId: 'place-1',
      })
    );
    expect(generateOrderDeliveredText).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: 'ORD-001',
        customerName: 'Jane Doe',
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        htmlContent: '<html>delivered</html>',
        textContent: 'delivered text',
      })
    );
  });

  it('marks a queued delivered outbox event consumed after manual send success', async () => {
    const supabase = createSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });

    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: orderId }),
    });

    expect(response.status).toBe(200);
    expect(
      (supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc
    ).toHaveBeenCalledWith('complete_order_notification_outbox_manual_result', {
      p_event_type: 'order_delivered',
      p_merchant_id: 'merchant-1',
      p_message_id: 'msg-1',
      p_order_id: orderId,
      p_skip_reason: null,
      p_status: 'sent',
    });
  });

  it('skips delivered email for legacy orders without a customer email', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase: createSupabaseMock({
        ...deliveredOrder,
        customer_email: null,
      }),
    });

    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      notificationSkipped: true,
      reason: 'missing_customer_email',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
