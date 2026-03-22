import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getRootDomain: vi.fn(() => 'usebaci.com'),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: vi.fn(),
}));

import { sendImportNotificationCampaign } from '@/lib/import-notifications/send-import-notification-campaign';
import { sendEmail } from '@/lib/zeptomail';

function createOrdersQueryMock(response: {
  data: unknown;
  error: Error | null;
}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.not.mockResolvedValue(response);
  return query;
}

function createSupabaseMock(response: { data: unknown; error: Error | null }) {
  return {
    from: vi.fn().mockReturnValue(createOrdersQueryMock(response)),
  } as unknown as SupabaseClient;
}

describe('sendImportNotificationCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates recipients by email, skips unclaimable customers, and uses configured app-first copy', async () => {
    const supabase = createSupabaseMock({
      data: [
        {
          customer_id: 'customer-1',
          customer_email: 'ada@example.com',
          customer_name: 'Ada',
          order_number: 'ORD-1',
          payment_status: 'paid',
          shipping_status: 'delivered',
        },
        {
          customer_id: 'customer-1',
          customer_email: 'ada@example.com',
          customer_name: 'Ada',
          order_number: 'ORD-2',
          payment_status: 'paid',
          shipping_status: 'delivered',
        },
        {
          customer_id: null,
          customer_email: 'skip@example.com',
          customer_name: 'Skip',
          order_number: 'ORD-3',
          payment_status: 'paid',
          shipping_status: 'delivered',
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
        },
      },
    });

    expect(result).toEqual({
      sentCount: 1,
      skippedCount: 1,
      failedCount: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Ogabassey: your updated receipt is ready',
        htmlContent: expect.stringContaining('Open the Ogabassey app'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining(
          'https://ogabassey.usebaci.com/receipts'
        ),
      })
    );
  });

  it('respects a site-first custom delivery override', async () => {
    const supabase = createSupabaseMock({
      data: [
        {
          customer_id: 'customer-1',
          customer_email: 'ada@example.com',
          customer_name: 'Ada',
          order_number: 'ORD-1',
          payment_status: 'paid',
          shipping_status: 'delivered',
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
        },
      },
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Future Merchant: your updated order history is ready',
        htmlContent: expect.stringContaining(
          'https://futuremerchant.com/receipts'
        ),
      })
    );
  });

  it('sanitizes merchant-provided content before building html email content', async () => {
    const supabase = createSupabaseMock({
      data: [
        {
          customer_id: 'customer-1',
          customer_email: 'ada@example.com',
          customer_name: '<Ada>',
          order_number: 'ORD-1',
          payment_status: 'paid',
          shipping_status: 'delivered',
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
          app_store_url: 'javascript:alert(1)',
        },
      },
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.not.stringContaining('javascript:alert(1)'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.not.stringContaining(
          '<Merchant Six> has moved your previous order history'
        ),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining('\\u003cMerchant Six\\u003e'),
      })
    );
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
          customer_id: 'customer-1',
          customer_email: 'ada@example.com',
          customer_name: 'Ada',
          order_number: 'ORD-1',
          payment_status: 'paid',
          shipping_status: 'delivered',
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
      customSettings: null,
    });

    expect(result).toEqual({
      sentCount: 0,
      skippedCount: 0,
      failedCount: 1,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
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
