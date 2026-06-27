import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_ROOT_DOMAIN: 'example.com' },
}));

import { sendOrderUpdatedEmail } from './order-update-email';

const order = {
  amount_paid: 0,
  customer_email: 'ada@example.com' as string | null,
  customer_id: 'customer-1',
  customer_name: 'Ada Buyer' as string | null,
  currency: 'GBP',
  id: 'order-1',
  merchant_id: 'merchant-1',
  order_items: [{ name: 'Phone', price: 1000, quantity: 1 }],
  order_number: 'ORD-001',
  total: 1000 as number | string | null,
};

const merchant = {
  business_name: 'Baci Store',
  cac_rc_number: null,
  email: 'merchant@example.com',
  email_sender_name: 'Baci Sales',
  id: 'merchant-1',
  slug: 'bacistore',
  support_email: 'support@example.com',
  tax_identification_number: null,
};

function createSupabaseMock(options: {
  merchant?: typeof merchant | null;
  order?: typeof order | null;
}) {
  const from = vi.fn((table: string) => {
    const result =
      table === 'orders'
        ? { data: options.order ?? null, error: options.order ? null : {} }
        : {
            data: options.merchant ?? null,
            error: options.merchant ? null : {},
          };
    const chain = {
      eq: vi.fn(() => chain),
      select: vi.fn(() => chain),
      single: vi.fn().mockResolvedValue(result),
    };
    return chain;
  });

  return { from } as unknown as SupabaseClient;
}

describe('sendOrderUpdatedEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue({
      messageId: 'message-1',
      success: true,
    });
  });

  it('sends the order updated email with audit context', async () => {
    const result = await sendOrderUpdatedEmail({
      changeCategory: 'financial',
      changedFields: ['shipping_address', 'total'],
      orderId: 'order-1',
      supabase: createSupabaseMock({ merchant, order }),
    });

    expect(result).toEqual({ messageId: 'message-1', success: true });
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        auditContext: {
          customerId: 'customer-1',
          merchantId: 'merchant-1',
          metadata: {
            changeCategory: 'financial',
            changedFields: ['shipping_address', 'total'],
            trigger: 'order_updated_notification',
          },
          orderId: 'order-1',
        },
        emailType: 'orders',
        fromName: 'Baci Sales',
        replyTo: 'support@example.com',
        subject: 'Order #ORD-001 Has Been Updated',
        to: 'ada@example.com',
        toName: 'Ada Buyer',
      })
    );
    const emailPayload = mocks.sendEmail.mock.calls[0]?.[0];
    expect(emailPayload.htmlContent).toContain('£1,000.00');
    expect(emailPayload.htmlContent).toContain('Shipping address');
    expect(emailPayload.textContent).toContain('Updated Total: £1,000.00');
    expect(emailPayload.textContent).toContain('Shipping address');
  });

  it('skips sending when the order has no customer email', async () => {
    const result = await sendOrderUpdatedEmail({
      changeCategory: 'customer_visible',
      changedFields: ['Shipping address'],
      orderId: 'order-1',
      supabase: createSupabaseMock({
        merchant,
        order: { ...order, customer_email: null },
      }),
    });

    expect(result).toEqual({ error: 'no_customer_email', success: false });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('uses a safe greeting fallback when customer name is missing', async () => {
    await sendOrderUpdatedEmail({
      changeCategory: 'financial',
      changedFields: ['Items'],
      orderId: 'order-1',
      supabase: createSupabaseMock({
        merchant,
        order: { ...order, customer_name: null },
      }),
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining('Hi <strong>there</strong>'),
        textContent: expect.stringContaining('Hi there'),
        toName: undefined,
      })
    );
  });

  it('returns a failure when the order cannot be loaded', async () => {
    const result = await sendOrderUpdatedEmail({
      changeCategory: 'financial',
      changedFields: ['Items'],
      orderId: 'missing-order',
      supabase: createSupabaseMock({ merchant, order: null }),
    });

    expect(result).toEqual({
      error: 'order_not_found_for_email',
      success: false,
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('returns a failure when the merchant cannot be loaded', async () => {
    const result = await sendOrderUpdatedEmail({
      changeCategory: 'financial',
      changedFields: ['Items'],
      orderId: 'order-1',
      supabase: createSupabaseMock({ merchant: null, order }),
    });

    expect(result).toEqual({
      error: 'merchant_not_found_for_email',
      success: false,
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('returns a failure when the order total is not finite', async () => {
    const result = await sendOrderUpdatedEmail({
      changeCategory: 'financial',
      changedFields: ['total'],
      orderId: 'order-1',
      supabase: createSupabaseMock({
        merchant,
        order: { ...order, total: null },
      }),
    });

    expect(result).toEqual({
      error: 'invalid_order_total_for_email',
      success: false,
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('returns unsuccessful send results without converting them to success', async () => {
    mocks.sendEmail.mockResolvedValueOnce({
      error: 'provider_rejected',
      success: false,
    });

    const result = await sendOrderUpdatedEmail({
      changeCategory: 'financial',
      changedFields: ['Items'],
      orderId: 'order-1',
      supabase: createSupabaseMock({ merchant, order }),
    });

    expect(result).toEqual({ error: 'provider_rejected', success: false });
  });

  it('returns a failure when sendEmail throws', async () => {
    mocks.sendEmail.mockRejectedValueOnce(new Error('provider down'));

    const result = await sendOrderUpdatedEmail({
      changeCategory: 'financial',
      changedFields: ['Items'],
      orderId: 'order-1',
      supabase: createSupabaseMock({ merchant, order }),
    });

    expect(result).toEqual({ error: 'email_send_failed', success: false });
  });
});
