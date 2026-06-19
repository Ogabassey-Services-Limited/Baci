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

describe('sendImportNotificationCampaign failure handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when loading imported order recipients fails', async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: new Error('db'),
    });

    await expect(
      sendImportNotificationCampaign({
        supabase,
        importJobId: 'job-3',
        merchant: {
          id: 'merchant-3',
          slug: 'merchant-three',
          business_name: 'Merchant Three',
          custom_domain: null,
          support_email: null,
          email_sender_name: null,
          email: 'hello@merchant-three.com',
        },
        customSettings: null,
      })
    ).rejects.toThrow('Failed to load imported order recipients: db');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('counts failed sends when email delivery does not succeed', async () => {
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
      success: false,
      messageId: undefined,
    });

    const result = await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-4',
      merchant: {
        id: 'merchant-4',
        slug: 'merchant-four',
        business_name: 'Merchant Four',
        custom_domain: null,
        support_email: null,
        email_sender_name: null,
        email: 'hello@merchant-four.com',
      },
      customSettings: {
        migration_imports: {
          receipt_access_mode: 'app_first',
        },
      },
    });

    expect(result).toEqual({
      sentCount: 0,
      skippedCount: 0,
      failedCount: 1,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(
      (
        supabase as unknown as {
          testQueries: {
            claimDeleteQuery: {
              delete: ReturnType<typeof vi.fn>;
              eq: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).testQueries.claimDeleteQuery.delete
    ).toHaveBeenCalled();
    expect(
      (
        supabase as unknown as {
          testQueries: {
            claimDeleteQuery: {
              eq: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).testQueries.claimDeleteQuery.eq
    ).toHaveBeenCalledWith('id', 'claim-1');
  });

  it('throws when the claim creation RPC fails', async () => {
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
          { data: null, error: new Error('claim rpc failed') },
        ],
      }
    );

    await expect(
      sendImportNotificationCampaign({
        supabase,
        importJobId: 'job-attach-failed',
        merchant: {
          id: 'merchant-attach-failed',
          slug: 'merchant-four',
          business_name: 'Merchant Four',
          custom_domain: null,
          support_email: null,
          email_sender_name: null,
          email: 'hello@merchant-four.com',
        },
        customSettings: {
          migration_imports: {
            receipt_access_mode: 'app_first',
          },
        },
      })
    ).rejects.toThrow('Failed to create receipt claim: claim rpc failed');

    expect(sendEmail).not.toHaveBeenCalled();
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
  });

  it('returns zero counts when there are no eligible imported orders', async () => {
    const supabase = createSupabaseMock({
      data: [],
      error: null,
    });

    const result = await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-5',
      merchant: {
        id: 'merchant-5',
        slug: 'merchant-five',
        business_name: 'Merchant Five',
        custom_domain: null,
        support_email: null,
        email_sender_name: null,
        email: 'hello@merchant-five.com',
      },
      customSettings: null,
    });

    expect(result).toEqual({
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
