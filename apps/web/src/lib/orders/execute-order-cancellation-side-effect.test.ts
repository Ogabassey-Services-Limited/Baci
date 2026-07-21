import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initiateRefund: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/paystack', () => ({ initiateRefund: mocks.initiateRefund }));
vi.mock('@/lib/zeptomail', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('@/lib/orders/build-order-cancellation-email-message', () => ({
  buildOrderCancellationEmailMessage: vi.fn(() => ({
    to: 'buyer@example.com',
  })),
}));

import { executeOrderCancellationSideEffect } from './execute-order-cancellation-side-effect';
import { DeliveryUncertainError } from './run-order-cancellation-side-effect';

const merchant = {
  business_name: 'Store',
  cac_rc_number: null,
  email: 'store@example.com',
  email_sender_name: null,
  id: 'merchant-1',
  slug: 'store',
  support_email: null,
  tax_identification_number: null,
};
const order = {
  amount_paid: 100,
  currency: 'NGN',
  customer_email: 'buyer@example.com',
  customer_id: null,
  customer_name: 'Buyer',
  id: 'order-1',
  merchant_id: 'merchant-1',
  order_items: [],
  order_number: 'ORD-1',
  payment_status: 'paid',
  total: 100,
};

function refundClient(insertError: Error | null = null) {
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const single = vi.fn().mockResolvedValue({
    data: { gateway: 'paystack', gateway_reference: 'ref-1' },
    error: null,
  });
  const chain = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single,
  };
  const from = vi
    .fn()
    .mockReturnValueOnce(chain)
    .mockReturnValueOnce({ insert });
  return { from, insert };
}

describe('executeOrderCancellationSideEffect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the cancellation email', async () => {
    mocks.sendEmail.mockResolvedValue({ success: true, messageId: 'msg-1' });

    await expect(
      executeOrderCancellationSideEffect({
        merchant,
        order,
        sendCancellationEmail: mocks.sendEmail,
        step: 'customer_email',
        supabase: { from: vi.fn() } as never,
      })
    ).resolves.toEqual({ messageId: 'msg-1' });
  });

  it('records a successful Paystack refund', async () => {
    const supabase = refundClient();
    mocks.initiateRefund.mockResolvedValue({
      data: { id: 42 },
      success: true,
    });

    await expect(
      executeOrderCancellationSideEffect({
        merchant,
        order,
        reason: 'Unavailable',
        step: 'refund',
        supabase: supabase as never,
      })
    ).resolves.toEqual({ refundId: 42 });
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100, transaction_type: 'refund' })
    );
  });

  it('quarantines ambiguous Paystack failures', async () => {
    const supabase = refundClient();
    mocks.initiateRefund.mockResolvedValue({
      code: 'NETWORK_ERROR',
      error: 'socket closed',
      success: false,
    });

    await expect(
      executeOrderCancellationSideEffect({
        merchant,
        order,
        step: 'refund',
        supabase: supabase as never,
      })
    ).rejects.toBeInstanceOf(DeliveryUncertainError);
  });
});
