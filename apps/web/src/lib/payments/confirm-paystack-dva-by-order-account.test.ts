import { beforeEach, describe, expect, it, vi } from 'vitest';

// Logger spy — lets the 23505-demotion test prove the right level is
// used. The production code paths use info/error from this module.
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import { confirmPaystackDvaByOrderAccount } from '@/lib/payments/confirm-paystack-dva-by-order-account';

// Helper test: looks up `order_payment_accounts` by `(provider='paystack',
// account_number)`, joins to `orders`, applies the B0 multi-key matcher,
// and either:
//   - reserves a pending `transactions` row through the locked RPC + returns the txn for the
//     webhook to flip (single match)
//   - files a `reconciliation_review` row + returns `{handled:true, 409}`
//     (ambiguous)
//   - returns `{handled:false}` (no match — caller falls through)
//
// Verified amount is in NGN (already converted from kobo by the webhook
// helper). Customer email + paid_at come from the verified Paystack
// response.

const baseAccountRow = {
  order_id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
  created_at: '2026-05-09T10:00:00Z',
  expires_at: '2026-05-09T11:30:00Z',
  orders: {
    id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
    merchant_id: 'merchant-1',
    customer_email: 'customer@example.com',
    total: '835000',
    currency: 'NGN',
    payment_status: 'pending',
    shipping_status: 'pending',
  },
};

const ctxBase = {
  accountNumber: '9812851228',
  gatewayReference: '100026260509110323000058369193',
  verifiedAmount: { amount: 835_000, currency: 'NGN' },
  paystackResponse: {
    customer: { email: 'customer@example.com' },
    paid_at: '2026-05-09T10:30:00Z',
  } as Record<string, unknown>,
};

function createSupabaseMock(opts: {
  accountRows?: unknown[];
  accountLookupError?: unknown;
  insertResult?: { data: unknown; error: unknown };
  reuseLookupResult?: { data: unknown; error: unknown };
  reviewError?: unknown;
}) {
  const state = {
    accountLookupCalls: 0,
    insertCalls: [] as Record<string, unknown>[],
    reviewUpserts: [] as Record<string, unknown>[],
    reuseLookups: 0,
  };

  const rows = opts.accountRows ?? [baseAccountRow];

  const supabase = {
    from(table: string) {
      if (table === 'order_payment_accounts') {
        state.accountLookupCalls++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: opts.accountLookupError ? null : rows,
              error: opts.accountLookupError ?? null,
            }),
          }),
        };
      }
      if (table === 'transactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(() => {
              state.reuseLookups++;
              const row = state.insertCalls.at(-1);
              return Promise.resolve(
                opts.reuseLookupResult ?? {
                  data: row
                    ? {
                        id: 'txn-new',
                        amount: row.amount,
                        currency: row.currency,
                        merchant_id: row.merchant_id,
                        metadata: row.metadata ?? null,
                        order_id: row.order_id,
                        platform_fee: 0,
                        gateway_reference: row.gateway_reference,
                      }
                    : null,
                  error: null,
                }
              );
            }),
          }),
        };
      }
      if (table === 'reconciliation_review') {
        return {
          upsert: vi.fn(),
          insert: vi.fn((row: Record<string, unknown>) => {
            state.reviewUpserts.push(row);
            return Promise.resolve({
              data: null,
              error: opts.reviewError ?? null,
            });
          }),
        };
      }
      throw new Error(`unmocked table: ${table}`);
    },
  };

  const rpc = vi.fn((name: string, params: Record<string, unknown>) => {
    if (name !== 'create_payment_transaction') {
      return Promise.resolve({ data: null, error: null });
    }
    const reserveRow = {
      amount: String(params.p_amount),
      currency: params.p_currency,
      gateway: params.p_gateway,
      gateway_reference: params.p_reference,
      merchant_id: params.p_merchant_id,
      metadata: params.p_metadata,
      order_id: params.p_order_id,
      status: 'pending',
      transaction_type: 'payment',
    };
    state.insertCalls.push(reserveRow);
    const result = opts.insertResult;
    if (result?.error) {
      return Promise.resolve({ data: null, error: result.error });
    }
    const resultData = result?.data as { id?: unknown } | null | undefined;
    return Promise.resolve({
      data: typeof resultData?.id === 'string' ? resultData.id : 'txn-new',
      error: null,
    });
  });

  return { supabase: { ...supabase, rpc }, state };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('confirmPaystackDvaByOrderAccount — single match', () => {
  it('inserts a pending transaction and returns it to the caller', async () => {
    const { supabase, state } = createSupabaseMock({});

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result.kind).not.toBe('review');
    expect(state.insertCalls).toHaveLength(1);
    expect(state.insertCalls[0]).toMatchObject({
      order_id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
      merchant_id: 'merchant-1',
      gateway: 'paystack',
      gateway_reference: '100026260509110323000058369193',
      status: 'pending',
      transaction_type: 'payment',
    });
    if (result.kind === 'match') {
      expect(result.transaction?.order_id).toBe(
        '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae'
      );
    }
  });

  it('matches against payable_amount when wallet or savings credits reduce the DVA charge', async () => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          payable_amount: '350000',
        },
      ],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
      verifiedAmount: { amount: 350_000, currency: 'NGN' },
    });

    expect(result.kind).toBe('match');
    expect(state.insertCalls).toHaveLength(1);
    expect(state.insertCalls[0]).toMatchObject({
      amount: '350000',
      order_id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
    });
  });

  it('uses assigned_at to match a retried DVA after the original created_at window expires', async () => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          created_at: '2026-05-09T08:00:00Z',
          assigned_at: '2026-05-09T10:00:00Z',
          expires_at: '2026-05-09T11:30:00Z',
        },
      ],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
      paystackResponse: {
        customer: { email: 'customer@example.com' },
        paid_at: '2026-05-09T10:30:00Z',
      },
    });

    expect(result.kind).toBe('match');
    expect(state.insertCalls).toHaveLength(1);
  });

  it('matches Tony-style exact payment received after the 90-minute window', async () => {
    const { supabase, state } = createSupabaseMock({});

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
      paystackResponse: {
        customer: { email: 'customer@example.com' },
        paid_at: '2026-05-09T12:53:00Z',
      },
    });

    expect(result.kind).toBe('match');
    expect(state.insertCalls).toHaveLength(1);
  });

  it('reuses the existing transaction when the locked RPC returns its id', async () => {
    const existing = {
      id: 'txn-existing',
      amount: 835_000,
      currency: 'NGN',
      merchant_id: 'merchant-1',
      metadata: { dva_lookup_path: 'order_payment_accounts' },
      order_id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
      platform_fee: 0,
      gateway_reference: '100026260509110323000058369193',
    };
    const { supabase, state } = createSupabaseMock({
      insertResult: { data: existing, error: null },
      reuseLookupResult: { data: existing, error: null },
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result.kind).not.toBe('review');
    if (result.kind === 'match') {
      expect(result.transaction?.id).toBe('txn-existing');
    }
    expect(state.reuseLookups).toBe(1);
  });
});

describe('confirmPaystackDvaByOrderAccount — no candidates / no DVA persisted', () => {
  it('returns handled:false without inserting when no DVA assignment matches', async () => {
    const { supabase, state } = createSupabaseMock({ accountRows: [] });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result).toEqual({ kind: 'none' });
    expect(state.insertCalls).toHaveLength(0);
    expect(state.reviewUpserts).toHaveLength(0);
  });

  it('skips a candidate whose order has been cancelled', async () => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          orders: {
            ...baseAccountRow.orders,
            shipping_status: 'cancelled',
          },
        },
      ],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result).toEqual({ kind: 'none' });
    expect(state.insertCalls).toHaveLength(0);
  });

  it('skips a candidate using the legacy canceled spelling', async () => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          orders: {
            ...baseAccountRow.orders,
            shipping_status: 'canceled',
          },
        },
      ],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result).toEqual({ kind: 'none' });
    expect(state.insertCalls).toHaveLength(0);
  });

  it.each([
    'paid',
    'refunded',
    'cancelled',
  ])('skips an order whose payment status is %s', async (paymentStatus) => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          orders: {
            ...baseAccountRow.orders,
            payment_status: paymentStatus,
          },
        },
      ],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result).toEqual({ kind: 'none' });
    expect(state.insertCalls).toHaveLength(0);
  });

  it('returns handled:false when account row exists but the 6-key match fails (e.g., wrong customer)', async () => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          orders: {
            ...baseAccountRow.orders,
            customer_email: 'someone-else@example.com',
          },
        },
      ],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result).toEqual({ kind: 'none' });
    expect(state.insertCalls).toHaveLength(0);
  });
});

describe('confirmPaystackDvaByOrderAccount — ambiguous match', () => {
  it('files an upserted reconciliation_review row and returns 409', async () => {
    const orderA = {
      ...baseAccountRow,
      order_id: 'order-a',
      orders: { ...baseAccountRow.orders, id: 'order-a' },
    };
    const orderB = {
      ...baseAccountRow,
      order_id: 'order-b',
      orders: { ...baseAccountRow.orders, id: 'order-b' },
    };
    const { supabase, state } = createSupabaseMock({
      accountRows: [orderA, orderB],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result.kind).toBe('review');
    if (result.kind === 'review') {
      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({
        code: 'AMBIGUOUS_DVA_MATCH',
      });
    }
    expect(state.reviewUpserts).toHaveLength(1);
    expect(state.reviewUpserts[0]).toMatchObject({
      issue_type: 'payment_match_ambiguous',
      paystack_ref: '100026260509110323000058369193',
    });
    expect(state.insertCalls).toHaveLength(0);
  });
});

describe('confirmPaystackDvaByOrderAccount — DB failure paths', () => {
  it('returns a 500 error when order_payment_accounts lookup fails', async () => {
    const { supabase, state } = createSupabaseMock({
      accountLookupError: {
        code: '57014',
        message: 'canceling statement due to statement timeout',
      },
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result).toEqual({
      body: { error: 'Paystack DVA matching temporarily unavailable' },
      kind: 'error',
      status: 500,
    });
    expect(state.insertCalls).toHaveLength(0);
    expect(state.reviewUpserts).toHaveLength(0);
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'B1 order_payment_accounts lookup failed',
      })
    );
  });

  it('still returns 409 review when the reconciliation_review insert fails (logged-and-continue)', async () => {
    // Two candidates match → ambiguous → helper attempts to file a
    // reconciliation_review row. The DB rejects the insert (e.g.,
    // transient RLS hiccup). Contract: helper still returns the 409
    // review payload so the webhook can short-circuit; the failure is
    // logged but does NOT throw or change the response shape.
    const orderA = {
      ...baseAccountRow,
      order_id: 'order-a',
      orders: { ...baseAccountRow.orders, id: 'order-a' },
    };
    const orderB = {
      ...baseAccountRow,
      order_id: 'order-b',
      orders: { ...baseAccountRow.orders, id: 'order-b' },
    };
    const { supabase, state } = createSupabaseMock({
      accountRows: [orderA, orderB],
      reviewError: { message: 'review insert failed', code: '23502' },
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result.kind).toBe('review');
    if (result.kind === 'review') {
      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({ code: 'AMBIGUOUS_DVA_MATCH' });
    }
    // Helper still attempted the write (so the cron can see what it
    // tried to record), and it did NOT silently swallow + match.
    expect(state.reviewUpserts).toHaveLength(1);
    expect(state.insertCalls).toHaveLength(0);
    // Non-23505 error → stays at logger.error (real failure to alert on).
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(loggerMock.info).not.toHaveBeenCalled();
  });

  it('logs 23505 review insert as info, not error (Paystack webhook retry hits the partial unique index)', async () => {
    // Same ambiguous shape as above, but the review insert raises
    // 23505 — the canonical "we returned 409, Paystack retried,
    // partial unique index `(issue_type, paystack_ref)` rejected the
    // duplicate insert" outcome. This is expected, benign traffic;
    // logging it at error spams the alerting pipeline. Contract:
    // helper logs at info and the response shape is unchanged.
    const orderA = {
      ...baseAccountRow,
      order_id: 'order-a',
      orders: { ...baseAccountRow.orders, id: 'order-a' },
    };
    const orderB = {
      ...baseAccountRow,
      order_id: 'order-b',
      orders: { ...baseAccountRow.orders, id: 'order-b' },
    };
    const { supabase, state } = createSupabaseMock({
      accountRows: [orderA, orderB],
      reviewError: {
        message:
          'duplicate key value violates unique constraint "reconciliation_review_open_by_paystack_ref_idx"',
        code: '23505',
      },
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result.kind).toBe('review');
    if (result.kind === 'review') {
      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({ code: 'AMBIGUOUS_DVA_MATCH' });
    }
    expect(state.reviewUpserts).toHaveLength(1);
    // The whole point: error log stays clean on retry traffic.
    expect(loggerMock.error).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledTimes(1);
    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('already filed'),
        paystackReference: ctxBase.gatewayReference,
      })
    );
  });

  it('returns a 500 error when a transaction reservation error occurs', async () => {
    // Single match → helper tries to reserve the pending transaction.
    // The DB rejects with a non-conflict error code (e.g., 23502
    // not-null violation). The helper must NOT treat this like a
    // benign idempotent reservation and must NOT consult the lookup;
    // it fails closed so the webhook can return a retryable 5xx.
    const { supabase, state } = createSupabaseMock({
      insertResult: {
        data: null,
        error: { code: '23502', message: 'not-null violation' },
      },
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result).toEqual({
      body: { error: 'Paystack DVA matching temporarily unavailable' },
      kind: 'error',
      status: 500,
    });
    expect(state.insertCalls).toHaveLength(1);
    // Critical: no transaction lookup should happen when the reservation fails.
    expect(state.reuseLookups).toBe(0);
  });

  it('returns a 500 error when a locked reservation cannot re-read the transaction', async () => {
    const { supabase, state } = createSupabaseMock({
      insertResult: {
        data: { id: 'txn-existing' },
        error: null,
      },
      reuseLookupResult: {
        data: null,
        error: { code: '57014', message: 'statement timeout' },
      },
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result).toEqual({
      body: { error: 'Paystack DVA matching temporarily unavailable' },
      kind: 'error',
      status: 500,
    });
    expect(state.insertCalls).toHaveLength(1);
    expect(state.reuseLookups).toBe(1);
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'B1 single-match transaction reservation lookup failed',
      })
    );
  });
});

describe('confirmPaystackDvaByOrderAccount — guards', () => {
  it('returns handled:false when accountNumber is malformed', async () => {
    const { supabase, state } = createSupabaseMock({});

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
      accountNumber: 'not-a-bank-account',
    });

    expect(result).toEqual({ kind: 'none' });
    expect(state.accountLookupCalls).toBe(0);
  });

  it('returns handled:false when verifiedAmount is missing', async () => {
    const { supabase } = createSupabaseMock({});

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
      verifiedAmount: null,
    });

    expect(result).toEqual({ kind: 'none' });
  });
});
