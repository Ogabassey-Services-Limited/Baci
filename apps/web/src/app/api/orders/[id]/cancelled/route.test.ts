import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
  getMerchantIdForApiUser: vi.fn(),
  initiateRefund: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
  getMerchantIdForApiUser: mocks.getMerchantIdForApiUser,
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));
vi.mock('@/lib/email-templates', () => ({
  generateOrderCancellationEmail: vi.fn(() => '<p>cancelled</p>'),
  generateOrderCancellationText: vi.fn(() => 'cancelled'),
}));
vi.mock('@/lib/order-queries', () => ({
  ORDER_WITH_ITEMS_QUERY: 'order fields',
}));
vi.mock('@/lib/paystack', () => ({
  initiateRefund: mocks.initiateRefund,
}));
vi.mock('@/lib/zeptomail', () => ({ sendEmail: mocks.sendEmail }));

import { POST } from './route';

function request(body: unknown): NextRequest {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest;
}

function selectResult(data: unknown) {
  const builder = {
    eq: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    select: vi.fn(() => builder),
  };
  return builder;
}

function createSupabase() {
  const merchant = {
    business_name: 'Store',
    cac_rc_number: null,
    email: 'merchant@example.com',
    email_sender_name: null,
    id: 'merchant-1',
    slug: 'store',
    support_email: 'support@example.com',
    tax_identification_number: null,
  };
  const order = {
    amount_paid: 0,
    currency: 'NGN',
    customer_email: 'customer@example.com',
    customer_id: 'customer-1',
    customer_name: 'Ada',
    id: 'order-1',
    merchant_id: 'merchant-1',
    order_items: [],
    order_number: 'ORD-1',
    payment_status: 'unpaid',
    shipping_status: 'cancelled',
    total: 5000,
  };
  const merchantBuilder = selectResult(merchant);
  const orderBuilder = selectResult(order);
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'merchants') return merchantBuilder;
      if (table === 'orders') return orderBuilder;
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  };
  return supabase;
}

describe('POST /api/orders/[id]/cancelled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.getMerchantIdForApiUser.mockResolvedValue('merchant-1');
    mocks.sendEmail.mockResolvedValue({
      messageId: 'message-1',
      success: true,
    });
  });

  it('requires an explicit cancellation confirmation', async () => {
    const response = await POST(request({ cancelled_by: 'merchant' }), {
      params: Promise.resolve({ id: 'order-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_REQUEST_BODY',
    });
    expect(mocks.authenticateApiRequest).not.toHaveBeenCalled();
  });

  it('cancels through the actor-audited RPC before notifying the customer', async () => {
    const supabase = createSupabase();
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { id: 'user-1' },
    });

    const response = await POST(
      request({
        cancelled_by: 'merchant',
        confirm_cancellation: true,
        reason: 'Customer requested cancellation',
      }),
      { params: Promise.resolve({ id: 'order-1' }) }
    );

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith('cancel_order_as_merchant', {
      p_order_id: 'order-1',
      p_reason: 'Customer requested cancellation',
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        auditContext: expect.objectContaining({ orderId: 'order-1' }),
        to: 'customer@example.com',
      })
    );
  });

  it('does not notify when the order is no longer cancellable', async () => {
    const supabase = createSupabase();
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'order_not_cancellable' },
    });
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { id: 'user-1' },
    });

    const response = await POST(request({ confirm_cancellation: true }), {
      params: Promise.resolve({ id: 'order-1' }),
    });

    expect(response.status).toBe(409);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('does not repeat refund or notification side effects when already cancelled', async () => {
    const supabase = createSupabase();
    supabase.rpc.mockResolvedValue({ data: false, error: null });
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { id: 'user-1' },
    });

    const response = await POST(request({ confirm_cancellation: true }), {
      params: Promise.resolve({ id: 'order-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      alreadyCancelled: true,
      success: true,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(mocks.initiateRefund).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
