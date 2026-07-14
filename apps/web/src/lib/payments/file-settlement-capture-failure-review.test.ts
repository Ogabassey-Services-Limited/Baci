import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileSettlementCaptureFailureReview } from '@/lib/payments/file-settlement-capture-failure-review';

const mocks = vi.hoisted(() => ({
  handlePaymentForCancelledOrder: vi.fn(),
}));

vi.mock('@/lib/payments/handle-payment-for-cancelled-order', () => ({
  handlePaymentForCancelledOrder: mocks.handlePaymentForCancelledOrder,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fileSettlementCaptureFailureReview', () => {
  it('files transaction-scoped settlement recovery without using the order outbox', async () => {
    mocks.handlePaymentForCancelledOrder.mockResolvedValue(true);

    await expect(
      fileSettlementCaptureFailureReview({
        error: new Error('rpc unavailable'),
        gateway: 'paystack',
        orderId: 'order-1',
        reference: 'REF-1',
        transactionId: 'txn-1',
      })
    ).resolves.toBe(true);

    expect(mocks.handlePaymentForCancelledOrder).toHaveBeenCalledWith({
      gatewayReference: 'REF-1',
      issueType: 'merchant_settlement_failed',
      order: { id: 'order-1' },
      reason:
        'Gateway paystack capture on an already-paid order could not be settled: rpc unavailable',
      transactionId: 'txn-1',
    });
  });

  it('propagates a failed durable review result', async () => {
    mocks.handlePaymentForCancelledOrder.mockResolvedValue(false);

    await expect(
      fileSettlementCaptureFailureReview({
        error: 'unknown failure',
        gateway: 'korapay',
        orderId: 'order-2',
        reference: 'REF-2',
        transactionId: 'txn-2',
      })
    ).resolves.toBe(false);
  });
});
