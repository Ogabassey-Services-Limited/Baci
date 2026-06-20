import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getRootDomain: vi.fn(() => 'usebaci.com'),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/import-notifications/receipt-claim-links', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/import-notifications/receipt-claim-links')
  >('@/lib/import-notifications/receipt-claim-links');

  return {
    ...actual,
    createReceiptClaimToken: vi.fn(() => ({
      token: 'claim-token',
      tokenHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })),
  };
});

import { createReceiptClaimToken } from '@/lib/import-notifications/receipt-claim-links';
import { sendImportNotificationCampaign } from '@/lib/import-notifications/send-import-notification-campaign';
import { sendEmail } from '@/lib/zeptomail';
import { createSupabaseMock } from './send-import-notification-campaign.test-utils';

describe('sendImportNotificationCampaign app-first claim links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates receipt claim links, groups devices by email, and sends receipt-changed copy', async () => {
    const supabase = createSupabaseMock({
      data: [
        {
          id: 'order-1',
          customer_id: 'customer-1',
          customer_email: 'ada@example.com',
          customer_name: 'Ada',
          order_number: 'ORD-1',
          payment_status: 'paid',
          shipping_status: 'delivered',
          order_items: [{ name: 'iPhone 16 Pro Max', quantity: 1 }],
        },
        {
          id: 'order-2',
          customer_id: 'customer-1',
          customer_email: 'ada@example.com',
          customer_name: 'Ada',
          order_number: 'ORD-2',
          payment_status: 'paid',
          shipping_status: 'delivered',
          order_items: [{ name: 'AirPods Pro', quantity: 2 }],
        },
        {
          id: 'order-3',
          customer_id: null,
          customer_email: 'skip@example.com',
          customer_name: 'Skip',
          order_number: 'ORD-3',
          payment_status: 'paid',
          shipping_status: 'delivered',
          order_items: [],
        },
      ],
      error: null,
    });
    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-1',
    });

    const result = await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-1',
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
        business_name: 'Ogabassey',
        custom_domain: null,
        support_email: 'support@ogabassey.com',
        email_sender_name: 'Ogabassey',
        email: 'hello@ogabassey.com',
      },
      customSettings: {
        migration_imports: {
          receipt_access_mode: 'app_first',
          receipt_app_links_enabled: true,
        },
      },
    });

    expect(result).toEqual({ sentCount: 1, skippedCount: 1, failedCount: 0 });
    expect(createReceiptClaimToken).toHaveBeenCalledTimes(1);
    const rpc = (
      supabase as unknown as {
        testQueries: { rpc: ReturnType<typeof vi.fn> };
      }
    ).testQueries.rpc;
    expect(rpc).toHaveBeenCalledWith(
      'create_receipt_claim_for_import_notification',
      expect.objectContaining({
        p_customer_email: 'ada@example.com',
        p_customer_id: 'customer-1',
        p_import_job_id: 'job-1',
        p_merchant_id: 'merchant-1',
        p_order_ids: ['order-1', 'order-2'],
        p_token_hash:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })
    );
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_expires_at');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Your receipt has moved',
        replyTo: 'support@ogabassey.com',
        htmlContent: expect.stringContaining('Hello Ada,'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining(
          'Ogabassey has moved your receipt for the following device(s) to the mobile app'
        ),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining('iPhone 16 Pro Max'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining('2 x AirPods Pro'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining(
          'https://ogabassey.usebaci.com/receipts/claim/claim-token'
        ),
      })
    );
  });
});
