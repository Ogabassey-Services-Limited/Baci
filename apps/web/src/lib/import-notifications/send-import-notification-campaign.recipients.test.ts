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

import { sendImportNotificationCampaign } from '@/lib/import-notifications/send-import-notification-campaign';
import { sendEmail } from '@/lib/zeptomail';
import { createSupabaseMock } from './send-import-notification-campaign.test-utils';

describe('sendImportNotificationCampaign recipient grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not merge imported orders for different customers sharing an email', async () => {
    const supabase = createSupabaseMock(
      {
        data: [
          {
            id: 'order-1',
            customer_id: 'customer-1',
            customer_email: 'shared@example.com',
            customer_name: 'Ada',
            order_number: 'ORD-1',
            payment_status: 'paid',
            shipping_status: 'delivered',
            order_items: [{ name: 'Pixel 9', quantity: 1 }],
          },
          {
            id: 'order-2',
            customer_id: 'customer-2',
            customer_email: 'shared@example.com',
            customer_name: 'Bola',
            order_number: 'ORD-2',
            payment_status: 'paid',
            shipping_status: 'delivered',
            order_items: [{ name: 'iPhone 16', quantity: 1 }],
          },
        ],
        error: null,
      },
      {
        claimRpcResponses: [
          { data: { claim_id: 'claim-1', status: 'created' }, error: null },
          { data: { claim_id: 'claim-2', status: 'created' }, error: null },
        ],
      }
    );

    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-shared',
    });

    const result = await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-shared-email',
      merchant: {
        id: 'merchant-shared',
        slug: 'ogabassey',
        business_name: 'Ogabassey',
        custom_domain: null,
        support_email: null,
        email_sender_name: null,
        email: 'hello@ogabassey.com',
      },
      customSettings: {
        migration_imports: {
          receipt_access_mode: 'app_first',
          receipt_app_links_enabled: true,
        },
      },
    });

    const rpc = (
      supabase as unknown as {
        testQueries: {
          rpc: ReturnType<typeof vi.fn>;
        };
      }
    ).testQueries.rpc;

    expect(result).toMatchObject({
      failedCount: 0,
      sentCount: 2,
      skippedCount: 0,
    });
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      'create_receipt_claim_for_import_notification',
      expect.objectContaining({
        p_customer_id: 'customer-1',
        p_order_ids: ['order-1'],
      })
    );
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'create_receipt_claim_for_import_notification',
      expect.objectContaining({
        p_customer_id: 'customer-2',
        p_order_ids: ['order-2'],
      })
    );
  });

  it('reports progress by grouped recipient instead of order row count', async () => {
    const onProgress = vi.fn();
    const supabase = createSupabaseMock(
      {
        data: [
          {
            id: 'order-1',
            customer_id: 'customer-1',
            customer_email: 'ada@example.com',
            customer_name: 'Ada',
            order_number: 'ORD-1',
            payment_status: 'paid',
            shipping_status: 'delivered',
            order_items: [{ name: 'Pixel 9', quantity: 1 }],
          },
          {
            id: 'order-2',
            customer_id: 'customer-1',
            customer_email: 'ADA@example.com',
            customer_name: 'Ada',
            order_number: 'ORD-2',
            payment_status: 'paid',
            shipping_status: 'delivered',
            order_items: [{ name: 'iPhone 16', quantity: 1 }],
          },
        ],
        error: null,
      },
      {
        claimRpcResponses: [
          { data: { claim_id: 'claim-1', status: 'created' }, error: null },
        ],
      }
    );

    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-1',
    });

    const result = await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-progress',
      merchant: {
        id: 'merchant-progress',
        slug: 'ogabassey',
        business_name: 'Ogabassey',
        custom_domain: null,
        support_email: null,
        email_sender_name: null,
        email: 'hello@ogabassey.com',
      },
      customSettings: {
        migration_imports: {
          receipt_access_mode: 'app_first',
          receipt_app_links_enabled: true,
        },
      },
      onProgress,
    });

    expect(result).toMatchObject({
      notificationProcessedRecipients: 1,
      notificationTotalRecipients: 1,
      sentCount: 1,
    });
    expect(onProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        processedRecipients: 0,
        totalRecipients: 1,
      })
    );
    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        processedRecipients: 1,
        totalRecipients: 1,
      })
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
