import type { SupabaseClient } from '@supabase/supabase-js';
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

function createClaimDeleteQueryMock(response: { error?: Error | null } = {}) {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
  };
  query.delete.mockReturnValue(query);
  query.eq.mockResolvedValue({ error: response.error ?? null });
  return query;
}

function createClaimUpdateQueryMock(response: { error?: Error | null } = {}) {
  const query = {
    eq: vi.fn(),
    update: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockResolvedValue({ error: response.error ?? null });
  return query;
}

function createSupabaseMock(
  response: { data: unknown; error: Error | null },
  options: {
    claimDeleteResponse?: { error?: Error | null };
    claimRpcResponses?: Array<{
      data?: { claim_id?: string | null; status: 'created' | 'skipped' } | null;
      error?: Error | null;
    }>;
    claimUpdateResponse?: { error?: Error | null };
  } = {}
) {
  const ordersQuery = createOrdersQueryMock(response);
  const claimDeleteQuery = createClaimDeleteQueryMock(
    options.claimDeleteResponse ?? {}
  );
  const claimUpdateQuery = createClaimUpdateQueryMock(
    options.claimUpdateResponse ?? {}
  );
  const receiptClaimsTable = {
    delete: claimDeleteQuery.delete,
    update: claimUpdateQuery.update,
  };
  const claimRpcResponses = options.claimRpcResponses ?? [
    { data: { claim_id: 'claim-1', status: 'created' }, error: null },
  ];
  const rpc = vi.fn((name: string) => {
    if (name !== 'create_receipt_claim_for_import_notification') {
      throw new Error(`Unexpected rpc ${name}`);
    }

    return Promise.resolve(
      claimRpcResponses.shift() ?? {
        data: { claim_id: 'claim-1', status: 'created' },
        error: null,
      }
    );
  });

  return {
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        return ordersQuery;
      }
      if (table === 'receipt_claims') {
        return receiptClaimsTable;
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc,
    testQueries: {
      claimDeleteQuery,
      claimUpdateQuery,
      ordersQuery,
      rpc,
    },
  } as unknown as SupabaseClient;
}

describe('sendImportNotificationCampaign', () => {
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
          order_items: [
            {
              name: 'iPhone 16 Pro Max',
              quantity: 1,
            },
          ],
        },
        {
          id: 'order-2',
          customer_id: 'customer-1',
          customer_email: 'ada@example.com',
          customer_name: 'Ada',
          order_number: 'ORD-2',
          payment_status: 'paid',
          shipping_status: 'delivered',
          order_items: [
            {
              name: 'AirPods Pro',
              quantity: 2,
            },
          ],
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
        },
      },
    });

    expect(result).toEqual({
      sentCount: 1,
      skippedCount: 1,
      failedCount: 0,
    });
    expect(createReceiptClaimToken).toHaveBeenCalledTimes(1);
    const rpc = (
      supabase as unknown as {
        testQueries: {
          rpc: ReturnType<typeof vi.fn>;
        };
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
        subject: 'Your Receipt Has Changed.',
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
        subject: 'Future Merchant: your updated order history is ready',
        htmlContent: expect.stringContaining(
          'https://futuremerchant.com/account/receipts'
        ),
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
        },
      },
    });

    expect(result).toEqual({
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
        },
      },
    });

    expect(result).toEqual({
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
