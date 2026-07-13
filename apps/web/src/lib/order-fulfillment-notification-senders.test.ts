import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  FulfillmentOrderRecord,
  MerchantRecord,
} from './order-fulfillment-notification-types';

vi.mock('@/lib/email-templates', () => ({
  generateOrderDeliveredEmail: vi.fn(() => '<html>delivered</html>'),
  generateOrderDeliveredText: vi.fn(() => 'delivered text'),
  generateOrderShippedEmail: vi.fn(() => '<html>shipped</html>'),
  generateOrderShippedText: vi.fn(() => 'shipped text'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: vi.fn(),
}));

import {
  generateOrderDeliveredEmail,
  generateOrderShippedEmail,
} from '@/lib/email-templates';
import { sendEmail } from '@/lib/zeptomail';
import { sendFulfillmentNotificationEmail } from './order-fulfillment-notification-senders';

const merchant: MerchantRecord = {
  id: 'merchant-1',
  business_name: 'Test Store',
  slug: 'test-store',
  support_email: 'support@test-store.com',
  email_sender_name: null,
  email: 'merchant@test-store.com',
};

const order: FulfillmentOrderRecord = {
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

describe('order fulfillment notification senders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'usebaci.com');
    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-1',
    });
  });

  it('renders shipped emails with canonical storefront tracking links', async () => {
    const result = await sendFulfillmentNotificationEmail({
      eventType: 'order_shipped',
      merchant,
      merchantId: 'merchant-1',
      order,
    });

    expect(result).toMatchObject({ status: 'sent', messageId: 'msg-1' });
    expect(generateOrderShippedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingUrl:
          'https://test-store.usebaci.com/track-order?token=track-token-123',
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        clientReference: 'order:order-1:shipped_email',
        to: 'jane@example.com',
      })
    );
  });

  it('skips shipped emails without a valid recipient', async () => {
    const result = await sendFulfillmentNotificationEmail({
      eventType: 'order_shipped',
      merchant,
      merchantId: 'merchant-1',
      order: { ...order, customer_email: null },
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'missing_customer_email',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('renders delivered emails with Google review context', async () => {
    const result = await sendFulfillmentNotificationEmail({
      eventType: 'order_delivered',
      featureSettings: { google_place_id: 'place-1' },
      merchant,
      merchantId: 'merchant-1',
      order: { ...order, shipping_status: 'delivered' },
    });

    expect(result).toMatchObject({
      hasGoogleRating: true,
      status: 'sent',
    });
    expect(generateOrderDeliveredEmail).toHaveBeenCalledWith(
      expect.objectContaining({ googlePlaceId: 'place-1' })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        clientReference: 'order:order-1:delivered_email',
        to: 'jane@example.com',
      })
    );
  });

  it('skips delivered emails without a valid recipient', async () => {
    const result = await sendFulfillmentNotificationEmail({
      eventType: 'order_delivered',
      featureSettings: { google_place_id: null },
      merchant,
      merchantId: 'merchant-1',
      order: { ...order, customer_email: null, shipping_status: 'delivered' },
    });

    expect(result).toEqual({
      hasGoogleRating: false,
      status: 'skipped',
      reason: 'missing_customer_email',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    'order_shipped',
    'order_delivered',
  ] as const)('returns failed when %s email sending fails', async (eventType) => {
    vi.mocked(sendEmail).mockResolvedValueOnce({
      success: false,
      error: 'provider down',
    });

    const result = await sendFulfillmentNotificationEmail({
      eventType,
      featureSettings: { google_place_id: 'place-1' },
      merchant,
      merchantId: 'merchant-1',
      order: {
        ...order,
        shipping_status:
          eventType === 'order_shipped' ? 'shipped' : 'delivered',
      },
    });

    expect(result).toEqual({
      status: 'failed',
      error: 'provider down',
      details: 'provider down',
    });
  });
});
