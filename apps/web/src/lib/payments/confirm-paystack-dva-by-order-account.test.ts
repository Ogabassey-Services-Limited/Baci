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

beforeEach(() => {
  vi.clearAllMocks();
  findWalletAccountMock.mockResolvedValue(null);
});

describe('confirmPaystackDvaByOrderAccount — matching', () => {
  it('reserves and returns the matching pending transaction', async () => {
    const { supabase, state } = createSupabaseMock({});

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result.kind).toBe('match');
    expect(state.insertCalls).toEqual([
      expect.objectContaining({
        amount: '835000',
        gateway: 'paystack',
        order_id: baseAccountRow.order_id,
        status: 'pending',
      }),
    ]);
  });

  it('uses the invoice payable amount when credits reduce the DVA charge', async () => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [{ ...baseAccountRow, payable_amount: '350000' }],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
      verifiedAmount: { amount: 350_000, currency: 'NGN' },
    });

    expect(result.kind).toBe('match');
    expect(state.insertCalls[0]).toMatchObject({ amount: '350000' });
  });

  it('matches unpaid generated invoices inside their active DVA window', async () => {
    const { supabase } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          orders: { ...baseAccountRow.orders, payment_status: 'unpaid' },
        },
      ],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
    });

    expect(result.kind).toBe('match');
    expect(findWalletAccountMock).not.toHaveBeenCalled();
  });

  it('matches an exact late invoice transfer only after wallet ownership is checked', async () => {
    const { supabase } = createSupabaseMock({});

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
      paystackResponse: {
        customer: { email: 'customer@example.com' },
        paid_at: '2026-05-09T12:53:00Z',
      },
    });

    expect(result.kind).toBe('match');
    expect(findWalletAccountMock).toHaveBeenCalledWith({
      receiverAccountNumber: ctxBase.accountNumber,
      supabase,
    });
  });
});
