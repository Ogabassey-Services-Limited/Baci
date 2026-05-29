import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindActiveWalletFundingIntentForTransfer =
  vi.fn<(...args: unknown[]) => unknown>();
const mockMarkWalletFundingIntentReviewRequired =
  vi.fn<(...args: unknown[]) => unknown>();
const mockRunPaidOrderSideEffects = vi.fn<(...args: unknown[]) => unknown>();
const mockExtractVerifiedGatewayFeeNgn = vi.fn<(...args: unknown[]) => number>(
  () => 300
);

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
