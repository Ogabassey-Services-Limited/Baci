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

describe('sendImportNotificationCampaign content safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes merchant-provided content before building html email content', async () => {
    const supabase = createSupabaseMock({
      data: [
        {
          id: 'order-1',
          customer_id: 'customer-1',
          customer_email: 'ada@example.com',
          customer_name: '<Ada>',
          order_number: 'ORD-1',
          payment_status: 'paid',
          shipping_status: 'delivered',
          order_items: [{ name: '<Device>', quantity: 1 }],
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
      importJobId: 'job-6',
      merchant: {
        id: 'merchant-6',
        slug: 'merchant-six',
        business_name: '<Merchant Six>',
        custom_domain: null,
        support_email: 'support@example.com',
        email_sender_name: null,
        email: 'hello@example.com',
      },
      customSettings: {
        migration_imports: {
          receipt_access_mode: 'app_first',
          receipt_app_links_enabled: true,
          app_store_url: 'javascript:alert(1)',
        },
      },
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.not.stringContaining('<Device>'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.not.stringContaining(
          '<Merchant Six> has moved your receipt'
        ),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining('\\u003cMerchant Six\\u003e'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.not.stringContaining('javascript:alert(1)'),
      })
    );
  });
});
