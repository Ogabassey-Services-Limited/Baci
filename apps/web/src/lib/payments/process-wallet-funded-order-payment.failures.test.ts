import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindActiveWalletFundingIntentForTransfer =
  vi.fn<(...args: unknown[]) => unknown>();
const mockMarkWalletFundingIntentReviewRequired =
  vi.fn<(...args: unknown[]) => unknown>();
const mockRunPaidOrderSideEffects = vi.fn<(...args: unknown[]) => unknown>();
const mockExtractVerifiedGatewayFeeNgn = vi.fn<(...args: unknown[]) => number>(
  () => 300
);

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

vi.mock('@/lib/payments/verified-gateway-fee', () => ({
  extractVerifiedGatewayFeeNgn: (...args: unknown[]) =>
    mockExtractVerifiedGatewayFeeNgn(...args),
}));

import { logger } from '@/lib/logger';
import { processWalletFundedOrderPayment } from '@/lib/payments/process-wallet-funded-order-payment';
import {
  createWalletFundedOrderPaymentSupabase as createSupabase,
  intent,
  transaction,
} from '@/lib/payments/process-wallet-funded-order-payment.test-utils';

describe('processWalletFundedOrderPayment failure paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindActiveWalletFundingIntentForTransfer.mockResolvedValue({
      intent,
      kind: 'match',
    });
    mockRunPaidOrderSideEffects.mockResolvedValue({ failedSteps: [] });
  });

  it('surfaces finalizer RPC failures without running paid-order side effects', async () => {
    const supabase = createSupabase();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error('finalizer failed'),
    } as never);

    await expect(
      processWalletFundedOrderPayment({
        gatewayReference: 'PSK_REF_1',
        gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
        scheduleAfter: vi.fn(),
        supabase: supabase as never,
        transaction,
      })
    ).rejects.toThrow('finalizer failed');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayReference: 'PSK_REF_1',
        intentId: intent.id,
        merchantId: intent.merchantId,
        message: 'Wallet-funded order finalizer RPC failed',
        orderId: intent.orderId,
      })
    );
    expect(mockRunPaidOrderSideEffects).not.toHaveBeenCalled();
  });

  it('surfaces intent matching errors without filing ambiguity review', async () => {
    mockFindActiveWalletFundingIntentForTransfer.mockRejectedValueOnce(
      new Error('match failed')
    );

    await expect(
      processWalletFundedOrderPayment({
        gatewayReference: 'PSK_REF_1',
        gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
        scheduleAfter: vi.fn(),
        supabase: createSupabase() as never,
        transaction,
      })
    ).rejects.toThrow('match failed');
    expect(mockMarkWalletFundingIntentReviewRequired).not.toHaveBeenCalled();
  });

  it('maps unavailable serialized inventory after wallet finalization to a 409 result', async () => {
    const supabase = createSupabase();
    supabase.rpc.mockImplementation((...args: unknown[]) => {
      if (args[0] === 'confirm_order_inventory_reservations') {
        return Promise.resolve({
          data: {
            alreadyConfirmed: 0,
            confirmedUnitCount: 0,
            exceptionCodes: [
              { itemId: 'item-1', code: 'late_payment_reservation_lost' },
            ],
            missingUnitCount: 1,
            reclaimedUnitCount: 0,
          },
          error: null,
        }) as never;
      }

      return Promise.resolve({
        data: {
          debited_amount: 20_000,
          excess_amount: 0,
          funded_amount: 20_000,
          order_id: 'order-1',
          order_paid: true,
          order_payment_transaction_id: 'txn-order-1',
          wallet_credit_transaction_id: 'wallet-credit-1',
          wallet_debit_transaction_id: 'wallet-debit-1',
        },
        error: null,
      }) as never;
    });

    const result = await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter: vi.fn(),
      supabase: supabase as never,
      transaction,
    });

    expect(result).toEqual({
      body: {
        code: 'serialized_inventory_unavailable',
        error: 'serialized_inventory_unavailable',
        orderId: 'order-1',
      },
      kind: 'processed',
      orderPaid: false,
      status: 409,
    });
    expect(mockRunPaidOrderSideEffects).not.toHaveBeenCalled();
    expect(mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'serialized_inventory_confirmation_failed',
        merchant_id: 'merchant-1',
        order_id: 'order-1',
        paystack_ref: 'PSK_REF_1',
      })
    );
  });

  it('surfaces paid-order side effect failures after money movement completes', async () => {
    mockRunPaidOrderSideEffects.mockRejectedValueOnce(
      new Error('side effects failed')
    );

    await expect(
      processWalletFundedOrderPayment({
        gatewayReference: 'PSK_REF_1',
        gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
        scheduleAfter: vi.fn(),
        supabase: createSupabase() as never,
        transaction,
      })
    ).rejects.toThrow('runPaidOrderSideEffects');
  });

  it('throws for retry when a paid finalizer has no persisted payment transaction', async () => {
    vi.useFakeTimers();
    const supabase = createSupabase({ orderTransactionData: null });
    supabase.rpc.mockResolvedValueOnce({
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

      const resultExpectation = expect(resultPromise).rejects.toThrow(
        'Missing order payment transaction for paid wallet-funded order order-1'
      );
      await vi.advanceTimersByTimeAsync(3500);
      await resultExpectation;
    } finally {
      vi.useRealTimers();
    }
    expect(supabase.orderTransactionSingle).toHaveBeenCalledTimes(4);
    expect(mockRunPaidOrderSideEffects).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayReference: 'PSK_REF_1',
        intentId: 'intent-1',
        message:
          'Missing order payment transaction for paid wallet-funded order; will retry',
        orderId: 'order-1',
      })
    );
  });

  it('fails closed when a paid finalizer omits the order id', async () => {
    const supabase = createSupabase();
    supabase.rpc.mockResolvedValueOnce({
      data: {
        debited_amount: 20_000,
        excess_amount: 0,
        funded_amount: 20_000,
        order_id: null,
        order_paid: true,
        order_payment_transaction_id: 'txn-order-1',
        wallet_credit_transaction_id: 'wallet-credit-1',
        wallet_debit_transaction_id: 'wallet-debit-1',
      },
      error: null,
    } as never);

    await expect(
      processWalletFundedOrderPayment({
        gatewayReference: 'PSK_REF_1',
        gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
        scheduleAfter: vi.fn(),
        supabase: supabase as never,
        transaction,
      })
    ).rejects.toThrow(
      'Missing order id for paid wallet-funded order intent intent-1'
    );
    expect(mockRunPaidOrderSideEffects).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayReference: 'PSK_REF_1',
        intentId: 'intent-1',
        message:
          'Wallet-funded order finalizer marked order paid without an order id',
      })
    );
  });

  it('fails closed when the finalizer returns a malformed payload', async () => {
    const supabase = createSupabase();
    supabase.rpc.mockResolvedValueOnce({
      data: {
        debited_amount: { amount: 20_000 },
        funded_amount: '20_000',
        order_id: 123,
        order_paid: 'true',
        order_payment_transaction_id: true,
      },
      error: null,
    } as never);

    await expect(
      processWalletFundedOrderPayment({
        gatewayReference: 'PSK_REF_1',
        gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
        scheduleAfter: vi.fn(),
        supabase: supabase as never,
        transaction,
      })
    ).rejects.toThrow('Wallet-funded order finalizer returned malformed data');
    expect(mockRunPaidOrderSideEffects).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Wallet-funded order finalizer returned malformed data',
      })
    );
  });

  it('throws for retry when Paystack paid_at is missing', async () => {
    await expect(
      processWalletFundedOrderPayment({
        gatewayReference: 'PSK_REF_1',
        gatewayResponse: {},
        scheduleAfter: vi.fn(),
        supabase: createSupabase() as never,
        transaction,
      })
    ).rejects.toThrow(
      'Missing or invalid Paystack paid_at for wallet-funded order transfer PSK_REF_1 on merchant merchant-1'
    );
    expect(mockFindActiveWalletFundingIntentForTransfer).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayReference: 'PSK_REF_1',
        gatewayResponse: {},
        merchantId: 'merchant-1',
      })
    );
  });

  it('marks ambiguous matches for review and lets the plain wallet top-up branch continue', async () => {
    mockFindActiveWalletFundingIntentForTransfer.mockResolvedValue({
      intentIds: ['intent-1', 'intent-2'],
      kind: 'ambiguous',
    });

    const supabase = createSupabase();
    const result = await processWalletFundedOrderPayment({
      gatewayReference: 'PSK_REF_1',
      gatewayResponse: { paid_at: '2026-05-26T12:05:00.000Z' },
      scheduleAfter: vi.fn(),
      supabase: supabase as never,
      transaction,
    });

    expect(result).toEqual({ kind: 'none' });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'file_wallet_order_funding_ambiguous_review',
      expect.objectContaining({
        p_gateway_reference: 'PSK_REF_1',
        p_intent_ids: ['intent-1', 'intent-2'],
      })
    );
  });
});
