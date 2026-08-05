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

  it('reserves a unique merchant-created invoice underpayment as partial', async () => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          orders: {
            ...baseAccountRow.orders,
            recorded_by_user_id: 'merchant-user-1',
          },
        },
      ],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
      verifiedAmount: { amount: 300_000, currency: 'NGN' },
    });

    expect(result.kind).toBe('match');
    expect(findWalletAccountMock).toHaveBeenCalledWith({
      receiverAccountNumber: ctxBase.accountNumber,
      supabase,
    });
    expect(state.insertCalls[0]).toMatchObject({
      amount: '300000',
      metadata: {
        dva_account_number: ctxBase.accountNumber,
        dva_lookup_path: 'order_payment_accounts',
        order_payment_allocation: 'merchant_invoice_partial',
        order_payment_outstanding_before: 835_000,
      },
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.objectContaining({
        p_merchant_amount: 297_950,
        p_platform_fee: 2050,
      })
    );
  });

  it('does not mark a merchant invoice paid from a stale exact DVA amount after its total increases', async () => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          payable_amount: '500000',
          orders: {
            ...baseAccountRow.orders,
            recorded_by_user_id: 'merchant-user-1',
            updated_at: '2026-05-09T10:05:00Z',
          },
        },
      ],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
      verifiedAmount: { amount: 500_000, currency: 'NGN' },
    });

    expect(result.kind).toBe('match');
    expect(state.insertCalls[0]).toMatchObject({
      metadata: {
        order_payment_allocation: 'merchant_invoice_partial',
        order_payment_outstanding_before: 835_000,
      },
    });
  });

  it('matches the remaining balance exactly after an earlier partial payment', async () => {
    const { supabase, state } = createSupabaseMock({
      accountRows: [
        {
          ...baseAccountRow,
          payable_amount: '835000',
          orders: {
            ...baseAccountRow.orders,
            amount_paid: '300000',
            payment_status: 'partially_paid',
            recorded_by_user_id: 'merchant-user-1',
          },
        },
      ],
    });

    const result = await confirmPaystackDvaByOrderAccount({
      supabase: supabase as never,
      ...ctxBase,
      verifiedAmount: { amount: 535_000, currency: 'NGN' },
    });

    expect(result.kind).toBe('match');
    expect(state.insertCalls[0]).toMatchObject({
      amount: '535000',
      metadata: {
        dva_account_number: ctxBase.accountNumber,
        dva_lookup_path: 'order_payment_accounts',
      },
    });
    expect(state.insertCalls[0]?.metadata).not.toHaveProperty(
      'order_payment_allocation'
    );
  });
});
