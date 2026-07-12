import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock('@/lib/zeptomail', () => ({ sendEmail }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { sendDeliveredNotification } from './order-fulfillment-delivered-sender';

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
  shipping_status: 'delivered' as const,
};

describe('sendDeliveredNotification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips orders without a valid customer email and preserves rating context', async () => {
    const result = await sendDeliveredNotification({
      merchantId: 'merchant-1',
      featureSettings: { google_place_id: 'place-1' },
      merchant,
      order: { ...order, customer_email: null },
    });
    expect(result).toEqual({
      status: 'skipped',
      reason: 'missing_customer_email',
      hasGoogleRating: true,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns sent after the provider accepts the delivered email', async () => {
    sendEmail.mockResolvedValue({ success: true, messageId: 'message-1' });

    const result = await sendDeliveredNotification({
      merchantId: 'merchant-1',
      featureSettings: { google_place_id: 'place-1' },
      merchant,
      order,
    });

    expect(result).toEqual({
      status: 'sent',
      message: 'Delivered notification sent',
      messageId: 'message-1',
      hasGoogleRating: true,
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        clientReference: 'order:order-1:delivered_email',
        to: 'customer@example.com',
      })
    );
  });

  it('returns the provider failure without throwing', async () => {
    sendEmail.mockResolvedValue({
      success: false,
      error: 'provider unavailable',
    });

    const result = await sendDeliveredNotification({
      merchantId: 'merchant-1',
      featureSettings: null,
      merchant,
      order,
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: 'provider unavailable',
    });
  });
});
