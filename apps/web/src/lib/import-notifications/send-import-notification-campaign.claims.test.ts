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

describe('sendImportNotificationCampaign claim modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses site-mode receipt links without creating claim rows', async () => {
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
      ],
      error: null,
    });

    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-2',
    });

    await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-2',
      merchant: {
        id: 'merchant-2',
        slug: 'future-merchant',
        business_name: 'Future Merchant',
        custom_domain: 'futuremerchant.com',
        support_email: null,
        email_sender_name: null,
        email: 'hello@futuremerchant.com',
      },
      customSettings: {
        migration_imports: {
          receipt_access_mode: 'site',
          receipt_path: '/account/receipts',
        },
      },
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Your receipt has moved',
        replyTo: 'hello@futuremerchant.com',
        htmlContent: expect.stringContaining(
          'https://futuremerchant.com/account/receipts'
        ),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining(
          'Future Merchant has moved your receipt for the following item(s) to your online account'
        ),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.not.stringContaining('Download options'),
      })
    );
    expect(createReceiptClaimToken).not.toHaveBeenCalled();
    expect(
      (
        supabase as unknown as {
          testQueries: {
            rpc: ReturnType<typeof vi.fn>;
          };
        }
      ).testQueries.rpc
    ).not.toHaveBeenCalled();
  });

  it('uses web-only claim links for merchants configured app-first without app links', async () => {
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
      ],
      error: null,
    });

    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-3',
    });

    await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-3',
      merchant: {
        id: 'merchant-3',
        slug: 'future-merchant',
        business_name: 'Future Merchant',
        custom_domain: 'futuremerchant.com',
        support_email: 'support@futuremerchant.com',
        email_sender_name: null,
        email: 'hello@futuremerchant.com',
      },
      customSettings: {
        migration_imports: {
          app_store_url: 'https://apps.apple.com/app/future',
          play_store_url:
            'https://play.google.com/store/apps/details?id=future',
          receipt_access_mode: 'app_first',
        },
      },
    });

    expect(createReceiptClaimToken).toHaveBeenCalledTimes(1);
    expect(
      (
        supabase as unknown as {
          testQueries: {
            rpc: ReturnType<typeof vi.fn>;
          };
        }
      ).testQueries.rpc
    ).toHaveBeenCalledWith(
      'create_receipt_claim_for_import_notification',
      expect.objectContaining({
        p_customer_email: 'ada@example.com',
        p_customer_id: 'customer-1',
        p_import_job_id: 'job-3',
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'support@futuremerchant.com',
        htmlContent: expect.stringContaining(
          'https://futuremerchant.com/receipts/claim/claim-token'
        ),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining('/receipts/claim/'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.not.stringContaining('Download options'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.not.stringContaining('mobile app'),
      })
    );
  });

  it('skips existing receipt claims that were already notified', async () => {
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
        ],
        error: null,
      },
      {
        claimRpcResponses: [{ data: { status: 'skipped' }, error: null }],
      }
    );

    const result = await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-existing',
      merchant: {
        id: 'merchant-existing',
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

    expect(result).toEqual({
      failedCount: 0,
      sentCount: 0,
      skippedCount: 1,
    });
    expect(createReceiptClaimToken).toHaveBeenCalledTimes(1);
    expect(
      (
        supabase as unknown as {
          testQueries: {
            rpc: ReturnType<typeof vi.fn>;
            claimDeleteQuery: {
              delete: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).testQueries.rpc
    ).toHaveBeenCalledWith(
      'create_receipt_claim_for_import_notification',
      expect.objectContaining({
        p_customer_email: 'ada@example.com',
        p_import_job_id: 'job-existing',
      })
    );
    expect(
      (
        supabase as unknown as {
          testQueries: {
            claimDeleteQuery: {
              delete: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).testQueries.claimDeleteQuery.delete
    ).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('uses the atomic claim RPC to rotate unnotified existing claims', async () => {
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
        ],
        error: null,
      },
      {
        claimRpcResponses: [
          {
            data: { claim_id: 'existing-claim', status: 'created' },
            error: null,
          },
        ],
      }
    );

    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-rotated',
    });

    const result = await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-existing',
      merchant: {
        id: 'merchant-existing',
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

    expect(result).toEqual({
      failedCount: 0,
      sentCount: 1,
      skippedCount: 0,
    });
    expect(
      (
        supabase as unknown as {
          testQueries: {
            claimDeleteQuery: {
              delete: ReturnType<typeof vi.fn>;
            };
            rpc: ReturnType<typeof vi.fn>;
          };
        }
      ).testQueries.rpc
    ).toHaveBeenCalledWith(
      'create_receipt_claim_for_import_notification',
      expect.objectContaining({
        p_import_job_id: 'job-existing',
        p_order_ids: ['order-1'],
      })
    );
    expect(
      (
        supabase as unknown as {
          testQueries: {
            claimDeleteQuery: {
              delete: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).testQueries.claimDeleteQuery.delete
    ).not.toHaveBeenCalled();
    expect(createReceiptClaimToken).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
