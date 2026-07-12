import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { sendDeliveredNotification } from './order-fulfillment-delivered-sender';

describe('sendDeliveredNotification', () => {
  it('skips orders without a valid customer email and preserves rating context', async () => {
    const result = await sendDeliveredNotification({
      merchantId: 'merchant-1',
      featureSettings: { google_place_id: 'place-1' },
      merchant: {
        id: 'merchant-1',
        business_name: 'Store',
        slug: 'store',
        support_email: null,
        email_sender_name: null,
        email: null,
      },
      order: {
        id: 'order-1',
        customer_name: 'Customer',
        customer_email: null,
        order_number: 'ORDER-1',
        order_items: [],
        shipping_status: 'delivered',
      },
    });
    expect(result).toEqual({
      status: 'skipped',
      reason: 'missing_customer_email',
      hasGoogleRating: true,
    });
  });
});
