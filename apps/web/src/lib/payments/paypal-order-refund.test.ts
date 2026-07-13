import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPaypalCheckoutCredentials } from '@/lib/payments/paypal-checkout-credentials';
import { refund } from '@/lib/paypal';
import {
  extractPaypalCaptureIds,
  initiatePaypalOrderRefund,
} from './paypal-order-refund';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/paypal', () => ({
  refund: vi.fn(),
}));

vi.mock('@/lib/payments/paypal-checkout-credentials', () => ({
  getPaypalCheckoutCredentials: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const MERCHANT_ID = 'merchant-1';

const CAPTURE_RESPONSE = {
  id: 'PP-ORD-1',
  status: 'COMPLETED',
  purchase_units: [
    {
      payments: {
        captures: [
          {
            id: 'CAPTURE-1',
            status: 'COMPLETED',
            amount: { currency_code: 'USD', value: '50.00' },
          },
        ],
      },
    },
  ],
};

// A split/partial settlement: two completed captures across two purchase units.
const SPLIT_CAPTURE_RESPONSE = {
  id: 'PP-ORD-2',
  status: 'COMPLETED',
  purchase_units: [
    {
      payments: {
        captures: [
          { id: 'CAPTURE-A', status: 'COMPLETED' },
          // A non-completed capture must be skipped (not refundable).
          { id: 'CAPTURE-PENDING', status: 'PENDING' },
        ],
      },
    },
    {
      payments: {
        captures: [{ id: 'CAPTURE-B', status: 'COMPLETED' }],
      },
    },
  ],
};

describe('extractPaypalCaptureIds', () => {
  it('returns every completed capture id across purchase units', () => {
    expect(extractPaypalCaptureIds(SPLIT_CAPTURE_RESPONSE)).toEqual([
      'CAPTURE-A',
      'CAPTURE-B',
    ]);
  });

  it('returns the single completed capture id from a simple response', () => {
    expect(extractPaypalCaptureIds(CAPTURE_RESPONSE)).toEqual(['CAPTURE-1']);
  });

  it('returns an empty array when the shape is missing or malformed', () => {
    expect(extractPaypalCaptureIds(null)).toEqual([]);
    expect(extractPaypalCaptureIds({})).toEqual([]);
    expect(extractPaypalCaptureIds({ purchase_units: [] })).toEqual([]);
    expect(
      extractPaypalCaptureIds({ purchase_units: [{ payments: {} }] })
    ).toEqual([]);
    // A completed capture with no id is not refundable.
    expect(
      extractPaypalCaptureIds({
        purchase_units: [{ payments: { captures: [{ status: 'COMPLETED' }] } }],
      })
    ).toEqual([]);
    // A capture with an id but no COMPLETED status is skipped.
    expect(
      extractPaypalCaptureIds({
        purchase_units: [
          { payments: { captures: [{ id: 'X', status: 'PENDING' }] } },
        ],
      })
    ).toEqual([]);
  });
});

describe('initiatePaypalOrderRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPaypalCheckoutCredentials).mockResolvedValue({
      clientId: 'cid',
      secretKey: 'sk',
    });
    vi.mocked(refund).mockResolvedValue({
      success: true,
      data: { id: 'REFUND-1', status: 'COMPLETED' },
    });
  });

  it('refunds the full capture through the merchant live credentials on success', async () => {
    const result = await initiatePaypalOrderRefund({
      merchantId: MERCHANT_ID,
      gatewayResponse: CAPTURE_RESPONSE,
      reason: 'Order cancelled',
    });

    expect(result).toEqual({
      success: true,
      refundId: 'REFUND-1',
      refundIds: ['REFUND-1'],
      captures: [
        {
          captureId: 'CAPTURE-1',
          success: true,
          status: 'COMPLETED',
          refundId: 'REFUND-1',
        },
      ],
    });
    expect(getPaypalCheckoutCredentials).toHaveBeenCalledWith(
      MERCHANT_ID,
      'live'
    );
    // Full refund: no amount passed → refunds the exact captured presentment.
    // A stable, capture-derived PayPal-Request-Id makes a retry idempotent (H2).
    expect(refund).toHaveBeenCalledWith('cid', 'sk', 'CAPTURE-1', 'live', {
      noteToPayer: 'Order cancelled',
      requestId: 'refund-CAPTURE-1',
    });
  });

  it('refunds EVERY completed capture on a split/partial settlement (R-55)', async () => {
    vi.mocked(refund)
      .mockResolvedValueOnce({
        success: true,
        data: { id: 'REFUND-A', status: 'COMPLETED' },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { id: 'REFUND-B', status: 'COMPLETED' },
      });

    const result = await initiatePaypalOrderRefund({
      merchantId: MERCHANT_ID,
      gatewayResponse: SPLIT_CAPTURE_RESPONSE,
      reason: 'Order cancelled',
    });

    expect(result.success).toBe(true);
    expect(result.refundIds).toEqual(['REFUND-A', 'REFUND-B']);
    // Both completed captures refunded; the PENDING capture was never touched.
    expect(refund).toHaveBeenCalledTimes(2);
    expect(refund).toHaveBeenNthCalledWith(
      1,
      'cid',
      'sk',
      'CAPTURE-A',
      'live',
      {
        noteToPayer: 'Order cancelled',
        requestId: 'refund-CAPTURE-A',
      }
    );
    expect(refund).toHaveBeenNthCalledWith(
      2,
      'cid',
      'sk',
      'CAPTURE-B',
      'live',
      {
        noteToPayer: 'Order cancelled',
        requestId: 'refund-CAPTURE-B',
      }
    );
  });

  it('surfaces a partial failure when one capture in the middle fails', async () => {
    vi.mocked(refund)
      .mockResolvedValueOnce({
        success: true,
        data: { id: 'REFUND-A', status: 'COMPLETED' },
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'Refund request failed: 422',
        code: 'HTTP_422',
      });

    const result = await initiatePaypalOrderRefund({
      merchantId: MERCHANT_ID,
      gatewayResponse: SPLIT_CAPTURE_RESPONSE,
      reason: 'Order cancelled',
    });

    // Overall failure because not every capture refunded, but the successful
    // capture's refund is still reported so it is never re-attempted blindly.
    expect(result.success).toBe(false);
    expect(result.refundIds).toEqual(['REFUND-A']);
    expect(result.error).toContain('CAPTURE-B');
    expect(result.error).toContain('1 of 2');
    expect(result.captures).toEqual([
      {
        captureId: 'CAPTURE-A',
        success: true,
        status: 'COMPLETED',
        refundId: 'REFUND-A',
      },
      {
        captureId: 'CAPTURE-B',
        success: false,
        error: 'Refund request failed: 422',
      },
    ]);
  });

  it('sends a stable PayPal-Request-Id derived from the capture id so a retry is idempotent (H2)', async () => {
    await initiatePaypalOrderRefund({
      merchantId: MERCHANT_ID,
      gatewayResponse: CAPTURE_RESPONSE,
      reason: 'Order cancelled',
    });
    // A retry after a lost/timed-out response must carry the SAME request id so
    // PayPal returns the original refund instead of issuing a second one.
    await initiatePaypalOrderRefund({
      merchantId: MERCHANT_ID,
      gatewayResponse: CAPTURE_RESPONSE,
      reason: 'Order cancelled',
    });

    const firstRequestId = vi.mocked(refund).mock.calls[0]?.[4]?.requestId;
    const secondRequestId = vi.mocked(refund).mock.calls[1]?.[4]?.requestId;

    expect(firstRequestId).toBe('refund-CAPTURE-1');
    expect(secondRequestId).toBe(firstRequestId);
    // Stays within PayPal's documented 38-char PayPal-Request-Id limit.
    expect((firstRequestId as string).length).toBeLessThanOrEqual(38);
  });

  it('fails gracefully when no completed capture can be found', async () => {
    const result = await initiatePaypalOrderRefund({
      merchantId: MERCHANT_ID,
      gatewayResponse: { purchase_units: [] },
      reason: 'Order cancelled',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('capture reference not found');
    expect(getPaypalCheckoutCredentials).not.toHaveBeenCalled();
    expect(refund).not.toHaveBeenCalled();
  });

  it('fails gracefully when the merchant has no PayPal credentials', async () => {
    vi.mocked(getPaypalCheckoutCredentials).mockResolvedValue(null);

    const result = await initiatePaypalOrderRefund({
      merchantId: MERCHANT_ID,
      gatewayResponse: CAPTURE_RESPONSE,
      reason: 'Order cancelled',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('PayPal is not configured for this store');
    expect(refund).not.toHaveBeenCalled();
  });

  it('surfaces a single-capture PayPal refund failure without throwing', async () => {
    vi.mocked(refund).mockResolvedValue({
      success: false,
      error: 'Refund request failed: 422',
      code: 'HTTP_422',
    });

    const result = await initiatePaypalOrderRefund({
      merchantId: MERCHANT_ID,
      gatewayResponse: CAPTURE_RESPONSE,
      reason: 'Order cancelled',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Refund request failed: 422');
    expect(result.refundIds).toEqual([]);
  });
  describe('refund resource status (Codex pass-11 P1)', () => {
    it('does NOT report success when PayPal accepts the refund but leaves it PENDING', async () => {
      // A 2xx means "request accepted", not "money returned". In BYOK the refund
      // draws on the merchant's OWN PayPal balance, so an unfunded balance leaves
      // it PENDING. Booking that as done records a completed refund for money the
      // buyer never got back.
      vi.mocked(refund).mockResolvedValue({
        success: true,
        data: { id: 'REFUND-P', status: 'PENDING' },
      });

      const result = await initiatePaypalOrderRefund({
        merchantId: MERCHANT_ID,
        gatewayResponse: CAPTURE_RESPONSE,
        reason: 'Order cancelled',
      });

      expect(result.success).toBe(false);
      expect(result.pending).toBe(true);
      expect(result.pendingRefundIds).toEqual(['REFUND-P']);
      // Crucially it must NOT read as a failure either — the remedy for a failed
      // refund is to issue another one, and doing that against an in-flight refund
      // pays the buyer twice.
      expect(result.error).toMatch(/do NOT issue another refund/i);
    });

    it.each([
      'CANCELLED',
      'FAILED',
    ] as const)('treats a %s refund as a hard failure, not a success', async (status) => {
      vi.mocked(refund).mockResolvedValue({
        success: true,
        data: { id: 'REFUND-X', status },
      });

      const result = await initiatePaypalOrderRefund({
        merchantId: MERCHANT_ID,
        gatewayResponse: CAPTURE_RESPONSE,
        reason: 'Order cancelled',
      });

      expect(result.success).toBe(false);
      expect(result.pending).toBeFalsy();
      expect(result.refundIds).toEqual([]);
      expect(result.error).toContain(status);
    });

    it('reports the per-capture PayPal status so ops can tell in-flight from failed', async () => {
      vi.mocked(refund).mockResolvedValue({
        success: true,
        data: { id: 'REFUND-P', status: 'PENDING' },
      });

      const result = await initiatePaypalOrderRefund({
        merchantId: MERCHANT_ID,
        gatewayResponse: CAPTURE_RESPONSE,
        reason: 'Order cancelled',
      });

      expect(result.captures).toEqual([
        {
          captureId: 'CAPTURE-1',
          success: false,
          status: 'PENDING',
          refundId: 'REFUND-P',
        },
      ]);
    });
  });
});
