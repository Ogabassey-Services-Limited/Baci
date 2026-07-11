import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPaypalCheckoutCredentials } from '@/lib/payments/paypal-checkout-credentials';
import { refund } from '@/lib/paypal';
import {
  extractPaypalCaptureId,
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

describe('extractPaypalCaptureId', () => {
  it('returns the first capture id from a stored capture response', () => {
    expect(extractPaypalCaptureId(CAPTURE_RESPONSE)).toBe('CAPTURE-1');
  });

  it('returns null when the shape is missing or malformed', () => {
    expect(extractPaypalCaptureId(null)).toBeNull();
    expect(extractPaypalCaptureId({})).toBeNull();
    expect(extractPaypalCaptureId({ purchase_units: [] })).toBeNull();
    expect(
      extractPaypalCaptureId({ purchase_units: [{ payments: {} }] })
    ).toBeNull();
    expect(
      extractPaypalCaptureId({
        purchase_units: [{ payments: { captures: [{ status: 'COMPLETED' }] } }],
      })
    ).toBeNull();
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

    expect(result).toEqual({ success: true, refundId: 'REFUND-1' });
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

  it('fails gracefully when the capture id cannot be found', async () => {
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

  it('surfaces a PayPal refund failure without throwing', async () => {
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

    expect(result).toEqual({
      success: false,
      error: 'Refund request failed: 422',
    });
  });
});
