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

describe('sendImportNotificationCampaign notification state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('continues sending later recipients when marking a claim as notified fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
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
        claimRpcResponses: [
          { data: { claim_id: 'claim-1', status: 'created' }, error: null },
          { data: { claim_id: 'claim-2', status: 'created' }, error: null },
        ],
        claimUpdateResponse: { error: new Error('update failed') },
      }
    );

    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      messageId: 'msg-sent',
    });

    const result = await sendImportNotificationCampaign({
      supabase,
      importJobId: 'job-update-failed',
      merchant: {
        id: 'merchant-update-failed',
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
      failedCount: 2,
      sentCount: 0,
      skippedCount: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
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
    ).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to mark receipt claim notification sent',
      expect.objectContaining({
        claimId: 'claim-1',
        importJobId: 'job-update-failed',
      })
    );
    consoleError.mockRestore();
  });
});
