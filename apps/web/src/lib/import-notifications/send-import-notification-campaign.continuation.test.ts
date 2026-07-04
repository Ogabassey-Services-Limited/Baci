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

describe('sendImportNotificationCampaign recipient continuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('continues sending later recipients when one send throws', async () => {
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
          order_items: [{ name: 'Pixel 9', quantity: 1 }],
        },
        {
          id: 'order-2',
          customer_id: 'customer-2',
          customer_email: 'bola@example.com',
          customer_name: 'Bola',
          order_number: 'ORD-2',
          payment_status: 'paid',
          shipping_status: 'delivered',
          order_items: [{ name: 'iPhone 16 Pro Max', quantity: 1 }],
        },
      ],
      error: null,
    });

    vi.mocked(sendEmail)
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce({
        success: true,
        messageId: 'msg-2',
      });

    const result = await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-throw',
      merchant: {
        id: 'merchant-throw',
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

    expect(result).toMatchObject({
      failedCount: 1,
      sentCount: 1,
      skippedCount: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(
      (
        supabase as unknown as {
          testQueries: {
            claimDeleteQuery: {
              delete: ReturnType<typeof vi.fn>;
            };
            claimUpdateQuery: {
              update: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).testQueries.claimDeleteQuery.delete
    ).toHaveBeenCalledTimes(1);
    expect(
      (
        supabase as unknown as {
          testQueries: {
            claimUpdateQuery: {
              update: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).testQueries.claimUpdateQuery.update
    ).toHaveBeenCalledWith({
      notification_sent_at: expect.any(String),
    });
  });

  it('continues sending later recipients when cleanup after a send throw fails', async () => {
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
            customer_id: 'customer-2',
            customer_email: 'bola@example.com',
            customer_name: 'Bola',
            order_number: 'ORD-2',
            payment_status: 'paid',
            shipping_status: 'delivered',
            order_items: [{ name: 'iPhone 16 Pro Max', quantity: 1 }],
          },
        ],
        error: null,
      },
      {
        claimDeleteResponse: { error: new Error('cleanup failed') },
        claimRpcResponses: [
          { data: { claim_id: 'claim-1', status: 'created' }, error: null },
          { data: { claim_id: 'claim-2', status: 'created' }, error: null },
        ],
      }
    );

    vi.mocked(sendEmail)
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce({
        success: true,
        messageId: 'msg-2',
      });

    const result = await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-cleanup-throw',
      merchant: {
        id: 'merchant-cleanup-throw',
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

    expect(result).toMatchObject({
      failedCount: 1,
      sentCount: 1,
      skippedCount: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(
      (
        supabase as unknown as {
          testQueries: {
            claimDeleteQuery: {
              delete: ReturnType<typeof vi.fn>;
            };
            claimUpdateQuery: {
              update: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).testQueries.claimDeleteQuery.delete
    ).toHaveBeenCalledTimes(1);
    expect(
      (
        supabase as unknown as {
          testQueries: {
            claimUpdateQuery: {
              update: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).testQueries.claimUpdateQuery.update
    ).toHaveBeenCalledWith({
      notification_sent_at: expect.any(String),
    });
  });
});
