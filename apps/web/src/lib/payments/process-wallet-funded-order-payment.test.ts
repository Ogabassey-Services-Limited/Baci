import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindActiveWalletFundingIntentForTransfer =
  vi.fn<(...args: unknown[]) => unknown>();
const mockMarkWalletFundingIntentReviewRequired =
  vi.fn<(...args: unknown[]) => unknown>();
const mockRunPaidOrderSideEffects = vi.fn<(...args: unknown[]) => unknown>();
const mockExtractVerifiedGatewayFeeNgn = vi.fn<(...args: unknown[]) => number>(
  () => 300
);
const mockClaimWalletCreditPush = vi.fn();

vi.mock('@/lib/payments/claim-wallet-credit-push', () => ({
  claimWalletCreditPush: (...args: unknown[]) =>
    mockClaimWalletCreditPush(...args),
}));

// handlePaymentForCancelledOrder files the reconciliation row through a
// service-role admin client (reconciliation_review is RLS-locked to
// service_role), not the wallet wrapper's own caller-supplied client.
const mockReconciliationInsert = vi.fn(async () => ({
  data: null,
  error: null,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'reconciliation_review') {
        return { insert: mockReconciliationInsert };
      }
      throw new Error(`Unexpected admin table: ${table}`);
    }),
  })),
}));

vi.mock('@/lib/order-wallet-funding-intents', () => ({
  findActiveWalletFundingIntentForTransfer: (...args: unknown[]) =>
    mockFindActiveWalletFundingIntentForTransfer(...args),
  markWalletFundingIntentReviewRequired: (...args: unknown[]) =>
    mockMarkWalletFundingIntentReviewRequired(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/payments/run-paid-order-side-effects', () => ({
  runPaidOrderSideEffects: (...args: unknown[]) =>
    mockRunPaidOrderSideEffects(...args),
}));

const mockNotifyWalletCredited = vi.fn<
  (...args: unknown[]) => Promise<{ status: 'sent' }>
>(async () => ({ status: 'sent' }));
vi.mock('@/lib/payments/notify-wallet-credited', () => ({
  notifyWalletCredited: (...args: unknown[]) =>
    mockNotifyWalletCredited(...args),
}));

vi.mock('@/lib/payments/verified-gateway-fee', () => ({
  extractVerifiedGatewayFeeNgn: (...args: unknown[]) =>
    mockExtractVerifiedGatewayFeeNgn(...args),
}));

import { logger } from '@/lib/logger';
import {
  buildFinalizeWalletParams,
  processWalletFundedOrderPayment,
} from '@/lib/payments/process-wallet-funded-order-payment';
import {
  createWalletFundedOrderPaymentSupabase as createSupabase,
  intent,
  transaction,
} from '@/lib/payments/process-wallet-funded-order-payment.test-utils';

describe('processWalletFundedOrderPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindActiveWalletFundingIntentForTransfer.mockResolvedValue({
      intent,
      kind: 'match',
    });
    mockRunPaidOrderSideEffects.mockResolvedValue({ failedSteps: [] });
    mockClaimWalletCreditPush.mockResolvedValue({ status: 'claimed' });
  });

  it('returns none for non-wallet-top-up transactions so plain order processing can continue', async () => {
    const result = await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: {},
      scheduleAfter: vi.fn(),
      supabase: createSupabase() as never,
      transaction: {
        ...transaction,
        metadata: { transaction_type: 'payment' },
      },
    });

    expect(result).toEqual({ kind: 'none' });
    expect(mockFindActiveWalletFundingIntentForTransfer).not.toHaveBeenCalled();
  });

  it('finalizes a matched wallet funding intent and runs paid-order side effects with allocated gateway fee', async () => {
    const supabase = createSupabase();

    const result = await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: { fees: 30_000, paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter: vi.fn(),
      supabase: supabase as never,
      transaction,
    });

    expect(result.kind).toBe('processed');
    expect(supabase.rpc).toHaveBeenCalledWith('finalize_wallet_funded_order', {
      p_currency: 'NGN',
      p_gateway_fee: 300,
      p_gateway_reference: 'PSK_REF_1',
      p_intent_id: 'intent-1',
      p_paid_at: '2026-05-26T12:05:00.000Z',
      p_received_amount: 20_000,
      p_transaction_id: 'txn-funding-1',
    });
    expect(mockRunPaidOrderSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        allocatedGatewayFeeNgn: 300,
        externalGatewayReference: 'PSK_REF_1',
        settlementGateway: 'paystack',
      })
    );
  });

  it('schedules a wallet-credit push for the credit the finalizer just committed', async () => {
    const tasks: Array<() => Promise<void>> = [];

    await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: { fees: 30_000, paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter: (task) => tasks.push(task),
      supabase: createSupabase() as never,
      transaction,
    });

    expect(tasks).toHaveLength(1);
    await tasks[0]?.();
    expect(mockNotifyWalletCredited).toHaveBeenCalledWith({
      amount: 20_000,
      currency: 'NGN',
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      returnTo: '/orders/order-1',
    });
  });

  it('notifies only the current transfer amount when funding is cumulative', async () => {
    const supabase = createSupabase();
    supabase.rpc.mockResolvedValue({
      data: {
        credited_amount: 8_000,
        debited_amount: 20_000,
        excess_amount: 0,
        funded_amount: 15_000,
        order_id: 'order-1',
        order_paid: false,
        order_payment_transaction_id: null,
        wallet_credit_transaction_id: 'wallet-credit-2',
        wallet_debit_transaction_id: null,
      },
      error: null,
    } as never);
    const tasks: Array<() => Promise<void>> = [];

    await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_2',
      gatewayResponse: { paid_at: '2026-05-26T12:10:00.000Z' },
      scheduleAfter: (task) => tasks.push(task),
      supabase: supabase as never,
      transaction: { ...transaction, amount: 10_000, id: 'txn-funding-2' },
    });

    await tasks[0]?.();
    expect(mockNotifyWalletCredited).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 8_000 })
    );
  });

  it('uses the raw transaction amount when retrying a finalized transfer notification', async () => {
    mockFindActiveWalletFundingIntentForTransfer.mockResolvedValue({
      intent: {
        ...intent,
        lastGatewayReference: 'PSK_REF_REPLAY',
        status: 'completed',
      },
      kind: 'match',
    });
    const supabase = createSupabase();
    supabase.rpc.mockResolvedValue({
      data: {
        credited_amount: 8_000,
        debited_amount: 20_000,
        excess_amount: 0,
        funded_amount: 28_000,
        order_id: 'order-1',
        order_paid: false,
        order_payment_transaction_id: null,
        wallet_credit_transaction_id: 'wallet-credit-replay',
        wallet_debit_transaction_id: null,
      },
      error: null,
    } as never);
    const tasks: Array<() => Promise<void>> = [];

    await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_REPLAY',
      gatewayResponse: { paid_at: '2026-05-26T12:15:00.000Z' },
      scheduleAfter: (task) => tasks.push(task),
      supabase: supabase as never,
      transaction: { ...transaction, amount: 20_000 },
    });

    await tasks[0]?.();
    expect(mockNotifyWalletCredited).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 20_000 })
    );
    expect(mockClaimWalletCreditPush).toHaveBeenCalledWith(
      expect.objectContaining({ allowInitialClaim: false })
    );
  });

  it('only retries the push marker when the matched transfer was already finalized', async () => {
    vi.useFakeTimers();
    try {
      mockFindActiveWalletFundingIntentForTransfer.mockResolvedValue({
        intent: {
          ...intent,
          fundedAmount: 20_000,
          lastGatewayReference: 'PSK_REF_1',
          lastTransactionId: 'txn-funding-1',
          status: 'completed',
        },
        kind: 'match',
      });
      const tasks: Array<() => Promise<void>> = [];
      mockClaimWalletCreditPush.mockResolvedValue({
        status: 'already_claimed',
      });

      await processWalletFundedOrderPayment({
        gatewayReference: 'PSK_REF_1',
        gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
        scheduleAfter: (task) => tasks.push(task),
        supabase: createSupabase() as never,
        transaction,
      });

      expect(tasks).toHaveLength(1);
      const task = tasks[0]?.();
      await vi.runAllTimersAsync();
      await task;
      expect(mockClaimWalletCreditPush).toHaveBeenCalledWith(
        expect.objectContaining({ allowInitialClaim: false })
      );
      expect(mockNotifyWalletCredited).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('claims a concurrent transfer notification only once after finalization', async () => {
    const supabase = createSupabase();
    const tasks: Array<() => Promise<void>> = [];
    const input = {
      gatewayReference: 'PSK_REF_CONCURRENT',
      gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter: (task: () => Promise<void>) => tasks.push(task),
      supabase: supabase as never,
      transaction: {
        ...transaction,
        id: 'txn-funding-concurrent',
      },
    };

    await Promise.all([
      processWalletFundedOrderPayment(input),
      processWalletFundedOrderPayment(input),
    ]);

    expect(tasks).toHaveLength(2);
    let initialClaimed = false;
    mockClaimWalletCreditPush.mockImplementation(
      async ({ allowInitialClaim }: { allowInitialClaim: boolean }) => {
        if (allowInitialClaim && !initialClaimed) {
          initialClaimed = true;
          return { status: 'claimed' };
        }
        return { status: 'already_claimed' };
      }
    );
    await Promise.all(tasks.map((task) => task()));
    expect(mockNotifyWalletCredited).toHaveBeenCalledTimes(1);
  });

  it('does not schedule a wallet-credit push when the finalizer never runs', async () => {
    mockFindActiveWalletFundingIntentForTransfer.mockResolvedValue({
      kind: 'none',
    });
    const scheduleAfter = vi.fn();

    const result = await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter,
      supabase: createSupabase() as never,
      transaction,
    });

    // Webhook retries find no active intent, so the credit push cannot double-fire.
    expect(result).toEqual({ kind: 'none' });
    expect(scheduleAfter).not.toHaveBeenCalled();
    expect(mockNotifyWalletCredited).not.toHaveBeenCalled();
  });

  it('builds finalizer RPC params with ISO paid time and gateway currency', () => {
    expect(
      buildFinalizeWalletParams({
        amount: 20_000,
        currency: 'NGN',
        gatewayFee: 300,
        gatewayReference: 'PSK_REF_1',
        intentId: 'intent-1',
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        transactionId: 'txn-funding-1',
      })
    ).toEqual({
      p_currency: 'NGN',
      p_gateway_fee: 300,
      p_gateway_reference: 'PSK_REF_1',
      p_intent_id: 'intent-1',
      p_paid_at: '2026-05-26T12:05:00.000Z',
      p_received_amount: 20_000,
      p_transaction_id: 'txn-funding-1',
    });
  });

  it('leaves underfunded transfers credited as wallet top-up without running order side effects', async () => {
    const supabase = createSupabase();
    supabase.rpc.mockResolvedValue({
      data: {
        debited_amount: 0,
        excess_amount: 0,
        funded_amount: 10_000,
        order_id: 'order-1',
        order_paid: false,
        order_payment_transaction_id: null,
        wallet_credit_transaction_id: 'wallet-credit-1',
        wallet_debit_transaction_id: null,
      },
      error: null,
    } as never);

    const result = await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter: vi.fn(),
      supabase: supabase as never,
      transaction,
    });

    expect(result).toMatchObject({ kind: 'processed', orderPaid: false });
    expect(mockRunPaidOrderSideEffects).not.toHaveBeenCalled();
  });

  it('rehydrates the order payment transaction when a paid finalizer omits its transaction id', async () => {
    const supabase = createSupabase();
    supabase.rpc.mockResolvedValue({
      data: {
        debited_amount: 20_000,
        excess_amount: 0,
        funded_amount: 20_000,
        order_id: 'order-1',
        order_paid: true,
        order_payment_transaction_id: null,
        wallet_credit_transaction_id: 'wallet-credit-1',
        wallet_debit_transaction_id: 'wallet-debit-1',
      },
      error: null,
    } as never);

    const result = await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter: vi.fn(),
      supabase: supabase as never,
      transaction,
    });

    expect(result).toMatchObject({ kind: 'processed', orderPaid: true });
    expect(mockRunPaidOrderSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        externalGatewayReference: 'PSK_REF_1',
        transaction: expect.objectContaining({ id: 'txn-order-1' }),
      })
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Missing order payment transaction for paid wallet-funded order; will retry',
      })
    );
  });

  it('suppresses paid-order side effects and files reconciliation when the order was clamped as cancelled', async () => {
    const supabase = createSupabase({
      orderCancellationState: {
        cancelled_at: '2026-05-26T12:10:00.000Z',
        id: 'order-1',
        shipping_status: 'cancelled',
      },
    });

    const result = await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter: vi.fn(),
      supabase: supabase as never,
      transaction,
    });

    expect(result).toMatchObject({ kind: 'processed', orderPaid: false });
    // No paid-order side effects ran for the cancelled order.
    expect(mockRunPaidOrderSideEffects).not.toHaveBeenCalled();
    // A reconciliation row was filed for manual refund through the
    // service-role admin client.
    expect(mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'payment_received_after_cancellation',
        order_id: 'order-1',
      })
    );
  });

  it('acks without retrying when a not-processable wallet intent points to a deleted order', async () => {
    const supabase = createSupabase({
      orderCancellationState: null,
    });
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message:
          'wallet_order_funding_intent_not_processable: cancelled, intent intent-1',
      },
    } as never);

    const result = await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter: vi.fn(),
      supabase: supabase as never,
      transaction,
    });

    expect(result).toMatchObject({
      body: { orderId: 'order-1', status: 'unknown' },
      kind: 'processed',
      orderPaid: false,
      status: 200,
    });
    expect(mockRunPaidOrderSideEffects).not.toHaveBeenCalled();
    expect(mockReconciliationInsert).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Wallet-funded order intent was not processable and order was not found; acking webhook to avoid retry storm',
        orderId: 'order-1',
      })
    );
  });

  it('acks and files reconciliation (no throw) when the finalizer RAISEs intent-not-processable for a cancelled order', async () => {
    // M1: a customer cancellation marks the funding intent 'cancelled', so a
    // late DVA transfer makes finalize_wallet_funded_order RAISE
    // 'wallet_order_funding_intent_not_processable' (P0001) and roll back its
    // own reconciliation row. The wrapper must re-check the order state, and —
    // because it is clamped as cancelled — ack 2xx + re-file the row here
    // instead of rethrowing (which would 500 the webhook).
    const supabase = createSupabase({
      orderCancellationState: {
        cancelled_at: '2026-05-26T12:10:00.000Z',
        id: 'order-1',
        shipping_status: 'cancelled',
      },
    });
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message:
          'wallet_order_funding_intent_not_processable: cancelled, intent intent-1',
      },
    } as never);

    const result = await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter: vi.fn(),
      supabase: supabase as never,
      transaction,
    });

    expect(result).toMatchObject({
      body: { orderId: 'order-1', status: 'cancelled' },
      kind: 'processed',
      orderPaid: false,
      status: 200,
    });
    // The finalizer raised before any paid-order work, so none ran.
    expect(mockRunPaidOrderSideEffects).not.toHaveBeenCalled();
    // The reconciliation row is re-filed through the service-role admin client.
    expect(mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'payment_received_after_cancellation',
        order_id: 'order-1',
      })
    );
  });

  it('retries briefly when a paid finalizer transaction is not immediately queryable', async () => {
    vi.useFakeTimers();
    const supabase = createSupabase({
      orderTransactionResponses: [
        { data: null },
        {
          data: {
            amount: 20_000,
            gateway_reference: 'WALLET-DVA-ORDER-order-1',
            id: 'txn-order-1',
            merchant_id: 'merchant-1',
            order_id: 'order-1',
            platform_fee: 0,
          },
        },
      ],
    });
    supabase.rpc.mockResolvedValue({
      data: {
        debited_amount: 20_000,
        excess_amount: 0,
        funded_amount: 20_000,
        order_id: 'order-1',
        order_paid: true,
        order_payment_transaction_id: null,
        wallet_credit_transaction_id: 'wallet-credit-1',
        wallet_debit_transaction_id: 'wallet-debit-1',
      },
      error: null,
    } as never);

    try {
      const resultPromise = processWalletFundedOrderPayment({
        gatewayReference: 'PSK_REF_1',
        gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
        scheduleAfter: vi.fn(),
        supabase: supabase as never,
        transaction,
      });

      await vi.advanceTimersByTimeAsync(500);
      await expect(resultPromise).resolves.toMatchObject({
        kind: 'processed',
        orderPaid: true,
      });
      expect(supabase.orderTransactionSingle).toHaveBeenCalledTimes(2);
      expect(mockRunPaidOrderSideEffects).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({ id: 'txn-order-1' }),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
