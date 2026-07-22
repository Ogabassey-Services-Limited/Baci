import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseAccountRow,
  createSupabaseMock,
  ctxBase,
} from '@/lib/payments/confirm-paystack-dva-by-order-account.test-support';

const loggerMock = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));
const findWalletAccountMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));
vi.mock('@/lib/customer-wallet-payment-accounts', () => ({
  findCustomerWalletPaymentAccountByReceiver: findWalletAccountMock,
}));

import { confirmPaystackDvaByOrderAccount } from '@/lib/payments/confirm-paystack-dva-by-order-account';

const unavailable = {
  body: { error: 'Paystack DVA matching temporarily unavailable' },
  kind: 'error',
  status: 500,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  findWalletAccountMock.mockResolvedValue(null);
});

describe('confirmPaystackDvaByOrderAccount — errors and review', () => {
  it('fails closed when wallet ownership lookup fails for a late invoice match', async () => {
    findWalletAccountMock.mockRejectedValue(new Error('wallet lookup failed'));
    const { supabase, state } = createSupabaseMock({});

    await expect(
      confirmPaystackDvaByOrderAccount({
        supabase: supabase as never,
        ...ctxBase,
        paystackResponse: {
          customer: { email: 'customer@example.com' },
          paid_at: '2026-05-09T12:53:00Z',
        },
      })
    ).resolves.toEqual(unavailable);
    expect(state.insertCalls).toHaveLength(0);
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'B1 active wallet DVA lookup failed',
      })
    );
  });

  it('files a manual review and returns 409 for ambiguous DVA candidates', async () => {
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

    expect(result).toMatchObject({
      kind: 'review',
      status: 409,
      body: { code: 'AMBIGUOUS_DVA_MATCH' },
    });
    expect(state.reviewUpserts).toEqual([
      expect.objectContaining({
        issue_type: 'payment_match_ambiguous',
        paystack_ref: ctxBase.gatewayReference,
      }),
    ]);
  });

  it('treats a duplicate review insert as expected webhook retry traffic', async () => {
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
    const { supabase } = createSupabaseMock({
      accountRows: [orderA, orderB],
      reviewError: { code: '23505', message: 'duplicate key' },
    });

    await expect(
      confirmPaystackDvaByOrderAccount({
        supabase: supabase as never,
        ...ctxBase,
      })
    ).resolves.toMatchObject({ kind: 'review', status: 409 });
    expect(loggerMock.error).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('already filed'),
      })
    );
  });

  it('returns 500 when lookup or transaction reservation fails', async () => {
    const lookup = createSupabaseMock({
      accountLookupError: { message: 'timeout' },
    });
    await expect(
      confirmPaystackDvaByOrderAccount({
        supabase: lookup.supabase as never,
        ...ctxBase,
      })
    ).resolves.toEqual(unavailable);

    const reservation = createSupabaseMock({
      insertResult: {
        data: null,
        error: { code: '23502', message: 'not-null violation' },
      },
    });
    await expect(
      confirmPaystackDvaByOrderAccount({
        supabase: reservation.supabase as never,
        ...ctxBase,
      })
    ).resolves.toEqual(unavailable);
    expect(reservation.state.reuseLookups).toBe(0);
  });
});
