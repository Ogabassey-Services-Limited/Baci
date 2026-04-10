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
  generateOrderShippedEmail: vi.fn(() => '<html>shipped</html>'),
  generateOrderShippedText: vi.fn(() => 'shipped text'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
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
  generateOrderShippedEmail,
  generateOrderShippedText,
} from '@/lib/email-templates';
import { sendEmail } from '@/lib/zeptomail';
import { POST } from './route';

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

const shippedOrder = {
  id: 'order-1',
  customer_id: 'customer-1',
  order_number: 'ORD-001',
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com',
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

type ShippedOrderFixture = Omit<
  typeof shippedOrder,
  'tracking_number' | 'tracking_token'
> & {
  tracking_number: string | null;
  tracking_token: string | null;
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

function createSupabaseMock(order: ShippedOrderFixture = shippedOrder) {
  const merchantBuilder = createSelectBuilder({ data: merchant, error: null });
  const orderBuilder = createSelectBuilder({ data: order, error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return merchantBuilder;
      }
      if (table === 'orders') {
        return orderBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as SupabaseClient;
}

function createRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/orders/order-1/shipped', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/orders/[id]/shipped', () => {
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

  it('uses saved order tracking details when the mobile client sends an empty body', async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: 'order-1' }),
    });

    expect(response.status).toBe(200);
    expect(generateOrderShippedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingNumber: 'T222600389',
        courierName: 'TOPSHIP',
        trackingUrl:
          'https://test-store.usebaci.com/track-order?token=track-token-123',
      })
    );
    expect(generateOrderShippedText).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingNumber: 'T222600389',
        courierName: 'TOPSHIP',
        trackingUrl:
          'https://test-store.usebaci.com/track-order?token=track-token-123',
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        htmlContent: '<html>shipped</html>',
        textContent: 'shipped text',
      })
    );
  });

  it('falls back to the global tracking page when the order has no tracking token', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase: createSupabaseMock({
        ...shippedOrder,
        tracking_token: null,
      }),
    });

    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: 'order-1' }),
    });

    expect(response.status).toBe(200);
    expect(generateOrderShippedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingNumber: 'T222600389',
        trackingUrl: 'https://usebaci.com/track/T222600389',
      })
    );
  });
});
