import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const afterCallbacks = vi.hoisted(
  () => [] as Array<() => void | Promise<void>>
);
const mockSendOrderUpdatedEmail = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');

  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      afterCallbacks.push(callback);
    },
  };
});

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/order-update-email', () => ({
  sendOrderUpdatedEmail: mockSendOrderUpdatedEmail,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { PATCH } from './route';

const validPayload = {
  branch_id: null,
  customer: {
    email: 'ada@example.com',
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Ada Buyer',
    phone: '+2348012345678',
  },
  discount_amount: 0,
  gift_wrapping_fee: 0,
  items: [
    {
      condition: 'new',
      image_url: 'https://cdn.example.test/s26.jpg',
      item_description: null,
      name: 'Samsung Galaxy S26',
      price: 1000000,
      product_id: '33333333-3333-4333-8333-333333333333',
      product_match_status: 'linked',
      quantity: 1,
      variant_attributes: { color: 'Black', storage: '512GB' },
      variant_id: null,
      variant_name: null,
    },
  ],
  notes: null,
  notify_customer: true,
  shipping_address: {
    address: '12 Allen Avenue',
    city: 'Ikeja',
    name: 'Ada Buyer',
    phone: '+2348012345678',
    state: 'Lagos',
  },
  shipping_fee: 2500,
  source: 'physical',
  tax_amount: 0,
};

const editResult = {
  change_category: 'financial',
  changed_fields: ['items', 'total'],
  customer_email: 'ada@example.com',
  merchant_id: 'merchant-1',
  notify_customer: true,
  order_id: '11111111-1111-4111-8111-111111111111',
};

function createMockUser(): User {
  return {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User;
}

function createRequest(
  payload: typeof validPayload = validPayload
): NextRequest {
  return {
    headers: new Headers(),
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as NextRequest;
}

function createSupabaseMock({
  rpcResult = editResult,
  refreshError = null,
}: {
  rpcResult?: typeof editResult;
  refreshError?: { message: string } | null;
} = {}) {
  const single = vi.fn().mockResolvedValue({
    data: refreshError ? null : { id: editResult.order_id, order_items: [] },
    error: refreshError,
  });
  const eq = vi.fn(() => selectBuilder);
  const selectBuilder = { eq, single };
  const from = vi.fn(() => ({
    select: vi.fn(() => selectBuilder),
  }));
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult, error: null });

  return {
    supabase: { from, rpc } as unknown as SupabaseClient,
  };
}

function callPatch(request: NextRequest) {
  return PATCH(request, {
    params: Promise.resolve({
      id: '11111111-1111-4111-8111-111111111111',
    }),
  });
}

describe('PATCH /api/orders/[id]/edit email scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    mockSendOrderUpdatedEmail.mockResolvedValue({ success: true });
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: true,
      response: undefined,
    });
  });

  it('schedules the order updated email after a successful opt-in financial edit', async () => {
    const { supabase } = createSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createRequest());

    expect(response.status).toBe(200);
    expect(afterCallbacks).toHaveLength(1);

    await afterCallbacks[0]?.();

    expect(mockSendOrderUpdatedEmail).toHaveBeenCalledWith({
      changeCategory: 'financial',
      changedFields: ['items', 'total'],
      orderId: '11111111-1111-4111-8111-111111111111',
      supabase,
    });
  });

  it('does not schedule email when the updated order refresh fails', async () => {
    const { supabase } = createSupabaseMock({
      refreshError: { message: 'refresh failed' },
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createRequest());

    expect(response.status).toBe(500);
    expect(afterCallbacks).toHaveLength(0);
  });

  it('does not schedule email when notification is not eligible', async () => {
    const { supabase } = createSupabaseMock({
      rpcResult: {
        ...editResult,
        change_category: 'internal',
        notify_customer: false,
      },
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(
      createRequest({ ...validPayload, notify_customer: false })
    );

    expect(response.status).toBe(200);
    expect(afterCallbacks).toHaveLength(0);
    expect(mockSendOrderUpdatedEmail).not.toHaveBeenCalled();
  });

  it('does not schedule email for a no-op retry result', async () => {
    const { supabase } = createSupabaseMock({
      rpcResult: {
        ...editResult,
        change_category: 'none',
        changed_fields: [],
        notify_customer: false,
      },
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createRequest());

    expect(response.status).toBe(200);
    expect(afterCallbacks).toHaveLength(0);
    expect(mockSendOrderUpdatedEmail).not.toHaveBeenCalled();
  });

  it('logs a warning when the scheduled email returns an error', async () => {
    const { supabase } = createSupabaseMock();
    mockSendOrderUpdatedEmail.mockResolvedValue({
      error: 'no_customer_email',
      success: false,
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createRequest());

    expect(response.status).toBe(200);
    await afterCallbacks[0]?.();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'no_customer_email',
        message: 'Order edit email was not sent',
      })
    );
  });

  it('logs an error when the scheduled email throws', async () => {
    const { supabase } = createSupabaseMock();
    const thrown = new Error('email failed');
    mockSendOrderUpdatedEmail.mockRejectedValue(thrown);
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createRequest());

    expect(response.status).toBe(200);
    await afterCallbacks[0]?.();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: thrown,
        message: 'Order edit email scheduling failed',
      })
    );
  });
});
