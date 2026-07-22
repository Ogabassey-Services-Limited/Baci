import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseAccountRow,
  createSupabaseMock,
  ctxBase,
} from '@/lib/payments/confirm-paystack-dva-by-order-account.test-support';

const findWalletAccountMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/customer-wallet-payment-accounts', () => ({
  findCustomerWalletPaymentAccountByReceiver: findWalletAccountMock,
}));

import { confirmPaystackDvaByOrderAccount } from '@/lib/payments/confirm-paystack-dva-by-order-account';

beforeEach(() => {
  vi.clearAllMocks();
  findWalletAccountMock.mockResolvedValue(null);
});

describe('confirmPaystackDvaByOrderAccount — eligibility', () => {
  it.each([
    'cancelled',
    'canceled',
  ])('rejects a %s shipping status', async (shippingStatus) => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          orders: { ...baseAccountRow.orders, shipping_status: shippingStatus },
        },
      ],
    });

    await expect(
      confirmPaystackDvaByOrderAccount({
        supabase: supabase as never,
        ...ctxBase,
      })
    ).resolves.toEqual({ kind: 'none' });
    expect(state.insertCalls).toHaveLength(0);
  });

  it.each([
    'paid',
    'refunded',
    'cancelled',
  ])('rejects a %s payment status', async (paymentStatus) => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          orders: { ...baseAccountRow.orders, payment_status: paymentStatus },
        },
      ],
    });

    await expect(
      confirmPaystackDvaByOrderAccount({
        supabase: supabase as never,
        ...ctxBase,
      })
    ).resolves.toEqual({ kind: 'none' });
    expect(state.insertCalls).toHaveLength(0);
  });

  it('leaves a late transfer for an active wallet DVA', async () => {
    findWalletAccountMock.mockResolvedValue({ id: 'wallet-account-1' });
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
    ).resolves.toEqual({ kind: 'none' });
    expect(state.insertCalls).toHaveLength(0);
  });

  it('returns none before querying for malformed DVA input', async () => {
    const { supabase, state } = createSupabaseMock({});

    await expect(
      confirmPaystackDvaByOrderAccount({
        supabase: supabase as never,
        ...ctxBase,
        accountNumber: 'not-a-bank-account',
      })
    ).resolves.toEqual({ kind: 'none' });
    expect(state.accountLookupCalls).toBe(0);
  });
});
