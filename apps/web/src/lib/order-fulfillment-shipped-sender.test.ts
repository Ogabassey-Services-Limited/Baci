import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock('@/lib/zeptomail', () => ({ sendEmail }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { sendShippedNotification } from './order-fulfillment-shipped-sender';

const merchant = {
  id: 'merchant-1',
  business_name: 'Store',
  slug: 'store',
  support_email: null,
  email_sender_name: null,
  email: null,
};
const order = {
  id: 'order-1',
  customer_name: 'Customer',
  customer_email: 'customer@example.com',
  order_number: 'ORDER-1',
  order_items: [],
  shipping_status: 'shipped' as const,
};

describe('sendShippedNotification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips orders without a valid customer email', async () => {
    const beforeProviderDispatch = vi.fn();
    const result = await sendShippedNotification({
      beforeProviderDispatch,
      merchantId: 'merchant-1',
      merchant,
      order: { ...order, customer_email: null },
    });
    expect(result).toEqual({
      status: 'skipped',
      reason: 'missing_customer_email',
    });
    expect(beforeProviderDispatch).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns sent after the provider accepts the shipped email', async () => {
    sendEmail.mockResolvedValue({ success: true, messageId: 'message-1' });
    const beforeProviderDispatch = vi.fn().mockResolvedValue(undefined);

    const result = await sendShippedNotification({
      beforeProviderDispatch,
      merchantId: 'merchant-1',
      merchant,
      order,
      trackingNumber: 'TRACK-1',
    });

    expect(result).toEqual({
      status: 'sent',
      message: 'Shipped notification sent',
      messageId: 'message-1',
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        clientReference: 'order:order-1:shipped_email',
        to: 'customer@example.com',
      })
    );
    expect(beforeProviderDispatch).toHaveBeenCalledOnce();
    expect(beforeProviderDispatch.mock.invocationCallOrder[0]).toBeLessThan(
      sendEmail.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it('returns the provider failure without throwing', async () => {
    sendEmail.mockResolvedValue({
      success: false,
      error: 'provider unavailable',
    });

    const result = await sendShippedNotification({
      merchantId: 'merchant-1',
      merchant,
      order,
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: 'provider unavailable',
    });
  });

  it('does not call the provider when the dispatch boundary fails', async () => {
    const beforeProviderDispatch = vi
      .fn()
      .mockRejectedValue(new Error('dispatch marker unavailable'));

    await expect(
      sendShippedNotification({
        beforeProviderDispatch,
        merchantId: 'merchant-1',
        merchant,
        order,
      })
    ).rejects.toThrow('dispatch marker unavailable');

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
