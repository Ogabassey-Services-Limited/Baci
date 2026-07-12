import { beforeEach, describe, expect, it, vi } from 'vitest';
import { filePaypalCapturePersistFailureReview } from './file-paypal-capture-persist-failure-review';
import { initiatePaypalOrderRefund } from './paypal-order-refund';
import { refundDuplicatePaypalCapture } from './refund-duplicate-paypal-capture';

vi.mock('server-only', () => ({}));

vi.mock('./paypal-order-refund', () => ({
  initiatePaypalOrderRefund: vi.fn(),
}));

vi.mock('./file-paypal-capture-persist-failure-review', () => ({
  filePaypalCapturePersistFailureReview: vi.fn().mockResolvedValue(undefined),
}));

const BASE = {
  merchantId: 'm-1',
  orderId: 'order-123e4567',
  transactionId: 'txn-1',
  gatewayReference: 'PP-DUP-1',
  gatewayResponse: {
    purchase_units: [{ payments: { captures: [{ id: 'CAP-1' }] } }],
  },
  orderNumber: 'BACI-2001',
  source: 'verify' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('refundDuplicatePaypalCapture', () => {
  it('refunds the duplicate capture, files a captured_after_settlement review, and returns success', async () => {
    (initiatePaypalOrderRefund as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      refundIds: ['REF-1'],
    });

    const res = await refundDuplicatePaypalCapture(BASE);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      status: 'success',
      orderNumber: 'BACI-2001',
    });
    expect(initiatePaypalOrderRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'm-1',
        gatewayResponse: BASE.gatewayResponse,
      })
    );
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-123e4567',
        transactionId: 'txn-1',
        metadata: expect.objectContaining({
          stage: 'captured_after_settlement',
          source: 'verify',
          refundSucceeded: true,
        }),
      })
    );
  });

  it('records the source (reconcile) that detected the duplicate', async () => {
    (initiatePaypalOrderRefund as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });

    await refundDuplicatePaypalCapture({ ...BASE, source: 'reconcile' });

    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ source: 'reconcile' }),
      })
    );
  });

  it('still returns success and records the failure when the refund fails (buyer already paid; flagged for manual refund)', async () => {
    (initiatePaypalOrderRefund as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'capture not refundable',
    });

    const res = await refundDuplicatePaypalCapture(BASE);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          refundSucceeded: false,
          refundError: 'capture not refundable',
        }),
      })
    );
  });

  it('falls back to a derived order number when none is provided', async () => {
    (initiatePaypalOrderRefund as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });

    const res = await refundDuplicatePaypalCapture({
      ...BASE,
      orderNumber: null,
    });
    const json = await res.json();

    expect(json.orderNumber).toBe('PP-DUP-1'.slice(0, 8).toUpperCase());
  });
});
