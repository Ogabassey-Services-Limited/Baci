import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateOrderCancellationEmail: vi.fn(() => '<p>cancelled</p>'),
  generateOrderCancellationText: vi.fn(() => 'cancelled'),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/email-templates', () => ({
  generateOrderCancellationEmail: mocks.generateOrderCancellationEmail,
  generateOrderCancellationText: mocks.generateOrderCancellationText,
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

import { sendOrderCancellationEmail } from './order-cancellation-email';

const order = {
  amount_paid: 5000,
  currency: 'INR',
  customer_email: 'ada@example.com' as string | null,
  customer_id: 'customer-1',
  customer_name: 'Ada Buyer' as string | null,
  id: 'order-1',
  merchant_id: 'merchant-1',
  order_items: [{ name: 'Phone', price: 5000, quantity: 1 }],
  order_number: 'ORD-001',
  total: 5000,
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

describe('sendOrderCancellationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue({
      messageId: 'message-1',
      success: true,
    });
  });

  it('threads the order currency through to the cancellation email templates', async () => {
    const result = await sendOrderCancellationEmail({
      cancelledBy: 'customer',
      orderId: 'order-1',
      refundAmount: 5000,
      supabase: createSupabaseMock({ merchant, order }),
    });

    expect(result).toEqual({ messageId: 'message-1', success: true });
    expect(mocks.generateOrderCancellationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'INR' })
    );
    expect(mocks.generateOrderCancellationText).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'INR' })
    );
  });

  it('renders NGN orders identically to the pre-multi-country baseline', async () => {
    await sendOrderCancellationEmail({
      cancelledBy: 'merchant',
      orderId: 'order-1',
      refundAmount: 0,
      supabase: createSupabaseMock({
        merchant,
        order: { ...order, currency: 'NGN' },
      }),
    });

    expect(mocks.generateOrderCancellationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'NGN' })
    );
  });

  it('falls back to NGN when the order has no currency recorded (legacy rows)', async () => {
    await sendOrderCancellationEmail({
      cancelledBy: 'merchant',
      orderId: 'order-1',
      refundAmount: 0,
      supabase: createSupabaseMock({
        merchant,
        order: { ...order, currency: null as unknown as string },
      }),
    });

    expect(mocks.generateOrderCancellationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'NGN' })
    );
  });

  it('returns a failure when the order cannot be loaded', async () => {
    const result = await sendOrderCancellationEmail({
      cancelledBy: 'customer',
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
    const result = await sendOrderCancellationEmail({
      cancelledBy: 'customer',
      orderId: 'order-1',
      supabase: createSupabaseMock({ merchant: null, order }),
    });

    expect(result).toEqual({
      error: 'merchant_not_found_for_email',
      success: false,
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('returns a failure when the order has no customer email', async () => {
    const result = await sendOrderCancellationEmail({
      cancelledBy: 'customer',
      orderId: 'order-1',
      supabase: createSupabaseMock({
        merchant,
        order: { ...order, customer_email: null },
      }),
    });

    expect(result).toEqual({ error: 'no_customer_email', success: false });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('returns a failure when sendEmail throws', async () => {
    mocks.sendEmail.mockRejectedValueOnce(new Error('provider down'));

    const result = await sendOrderCancellationEmail({
      cancelledBy: 'customer',
      orderId: 'order-1',
      supabase: createSupabaseMock({ merchant, order }),
    });

    expect(result).toEqual({ error: 'email_send_failed', success: false });
  });
});
