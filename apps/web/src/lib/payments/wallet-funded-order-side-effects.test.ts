import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderWalletFundingIntent } from '@/lib/order-wallet-funding-intent-types';
import type { PaidOrderSideEffectTransaction } from '@/lib/payments/paid-order-side-effect-types';
import { runWalletFundedPaidOrderSideEffects } from '@/lib/payments/wallet-funded-order-side-effects';

const mocks = vi.hoisted(() => ({
  fetchPaidOrder: vi.fn(),
  getWalletFundedOrderAllocatedGatewayFee: vi.fn(),
  runPaidOrderSideEffects: vi.fn(),
}));

vi.mock('@/lib/payments/order-wallet-funding-queries', () => ({
  fetchPaidOrder: mocks.fetchPaidOrder,
}));

vi.mock('@/lib/payments/run-paid-order-side-effects', () => ({
  runPaidOrderSideEffects: mocks.runPaidOrderSideEffects,
}));

vi.mock('@/lib/payments/wallet-funded-order-fee-allocation', () => ({
  getWalletFundedOrderAllocatedGatewayFee:
    mocks.getWalletFundedOrderAllocatedGatewayFee,
}));

function createMockIntent(
  overrides: Partial<OrderWalletFundingIntent> = {}
): OrderWalletFundingIntent {
  return {
    createdAt: '2026-05-26T12:00:00.000Z',
    currency: 'NGN',
    customerId: 'customer-1',
    debitedAmount: 0,
    excessAmount: 0,
    expectedAmount: 20_000,
    expiresAt: '2026-05-26T12:30:00.000Z',
    fundedAmount: 0,
    id: 'intent-1',
    idempotencyKey: 'order-wallet-funding:order-1:test',
    lastGatewayReference: null,
    lastTransactionId: null,
    merchantId: 'merchant-1',
    orderId: 'order-1',
    provider: 'paystack',
    status: 'funded',
    targetOrderAmount: 20_000,
    walletBalanceSnapshot: 0,
    walletPaymentAccountId: 'wallet-account-1',
    ...overrides,
  };
}

function createMockOrderTransaction(
  overrides: Partial<PaidOrderSideEffectTransaction> = {}
): PaidOrderSideEffectTransaction {
  return {
    amount: 20_000,
    gateway_reference: 'WALLET-DVA-ORDER-order-1',
    id: 'transaction-1',
    merchant_id: 'merchant-1',
    order_id: 'order-1',
    ...overrides,
  };
}

function createMockSupabase() {
  return {} as SupabaseClient;
}

describe('runWalletFundedPaidOrderSideEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPaidOrder.mockResolvedValue({
      id: 'order-1',
      merchant_id: 'merchant-1',
      payment_status: 'paid',
      subtotal: 20_000,
      total: 20_000,
    });
    mocks.getWalletFundedOrderAllocatedGatewayFee.mockResolvedValue(200);
    mocks.runPaidOrderSideEffects.mockResolvedValue(undefined);
  });

  it('runs paid-order side effects with the allocated gateway fee', async () => {
    const scheduleAfter = vi.fn();
    const supabase = createMockSupabase();
    const intent = createMockIntent();
    const orderTransaction = createMockOrderTransaction();
    const gatewayResponse = { paid_at: '2026-05-26T12:00:00.000Z' };

    await runWalletFundedPaidOrderSideEffects({
      gatewayFee: 300,
      gatewayReference: 'gateway-ref',
      gatewayResponse,
      intent,
      orderId: 'order-1',
      orderTransaction,
      scheduleAfter,
      supabase,
    });

    expect(mocks.fetchPaidOrder).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase,
    });
    expect(mocks.getWalletFundedOrderAllocatedGatewayFee).toHaveBeenCalledWith({
      fallbackFee: 300,
      intent,
      supabase,
    });
    expect(mocks.runPaidOrderSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'wallet-funded-order:gateway-ref',
        allocatedGatewayFeeNgn: 200,
        externalGatewayReference: 'gateway-ref',
        gatewayResponse,
        order: expect.objectContaining({ id: 'order-1' }),
        scheduleAfter,
        settlementGateway: 'paystack',
        supabase,
        transaction: orderTransaction,
      })
    );
  });

  it('rejects with context when the order fetch fails', async () => {
    mocks.fetchPaidOrder.mockRejectedValueOnce(new Error('missing order'));

    await expect(
      runWalletFundedPaidOrderSideEffects({
        gatewayFee: 300,
        gatewayReference: 'gateway-ref',
        gatewayResponse: {},
        intent: createMockIntent(),
        orderId: 'order-1',
        orderTransaction: createMockOrderTransaction(),
        scheduleAfter: vi.fn(),
        supabase: createMockSupabase(),
      })
    ).rejects.toThrow('fetchPaidOrder');
    expect(
      mocks.getWalletFundedOrderAllocatedGatewayFee
    ).not.toHaveBeenCalled();
  });

  it('rejects with context when fee allocation fails', async () => {
    mocks.getWalletFundedOrderAllocatedGatewayFee.mockRejectedValueOnce(
      new Error('fee failed')
    );

    await expect(
      runWalletFundedPaidOrderSideEffects({
        gatewayFee: 300,
        gatewayReference: 'gateway-ref',
        gatewayResponse: {},
        intent: createMockIntent(),
        orderId: 'order-1',
        orderTransaction: createMockOrderTransaction(),
        scheduleAfter: vi.fn(),
        supabase: createMockSupabase(),
      })
    ).rejects.toThrow('getWalletFundedOrderAllocatedGatewayFee');
    expect(mocks.runPaidOrderSideEffects).not.toHaveBeenCalled();
  });

  it('rejects with context when paid-order side effects fail', async () => {
    mocks.runPaidOrderSideEffects.mockRejectedValueOnce(
      new Error('side effects failed')
    );

    await expect(
      runWalletFundedPaidOrderSideEffects({
        gatewayFee: 300,
        gatewayReference: 'gateway-ref',
        gatewayResponse: {},
        intent: createMockIntent(),
        orderId: 'order-1',
        orderTransaction: createMockOrderTransaction(),
        scheduleAfter: vi.fn(),
        supabase: createMockSupabase(),
      })
    ).rejects.toThrow('runPaidOrderSideEffects');
  });

  it('rejects before querying when required intent identifiers are missing', async () => {
    await expect(
      runWalletFundedPaidOrderSideEffects({
        gatewayFee: 300,
        gatewayReference: 'gateway-ref',
        gatewayResponse: {},
        intent: createMockIntent({ id: '' }),
        orderId: 'order-1',
        orderTransaction: createMockOrderTransaction(),
        scheduleAfter: vi.fn(),
        supabase: createMockSupabase(),
      })
    ).rejects.toThrow('Invalid wallet funding intent');
    await expect(
      runWalletFundedPaidOrderSideEffects({
        gatewayFee: 300,
        gatewayReference: 'gateway-ref',
        gatewayResponse: {},
        intent: null as never,
        orderId: 'order-1',
        orderTransaction: createMockOrderTransaction(),
        scheduleAfter: vi.fn(),
        supabase: createMockSupabase(),
      })
    ).rejects.toThrow('Invalid wallet funding intent');
    expect(mocks.fetchPaidOrder).not.toHaveBeenCalled();
  });
});
