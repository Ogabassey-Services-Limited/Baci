import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyGatewayCharge } from '@/lib/payments/verify-gateway-charge';

const mocks = vi.hoisted(() => ({
  verifyKorapayPayment: vi.fn(),
  verifyPaystackPayment: vi.fn(),
}));

vi.mock('@/lib/korapay', () => ({
  verifyPayment: mocks.verifyKorapayPayment,
}));
vi.mock('@/lib/paystack', () => ({
  verifyTransaction: mocks.verifyPaystackPayment,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('verifyGatewayCharge', () => {
  it('returns the normalized amount for a successful Paystack verification', async () => {
    mocks.verifyPaystackPayment.mockResolvedValue({
      data: {
        amount: 12_345,
        currency: 'NGN',
        status: 'success',
      },
      success: true,
    });

    await expect(
      verifyGatewayCharge('paystack', 'successful-ref')
    ).resolves.toEqual({
      amount: 123.45,
      currency: 'NGN',
      ok: true,
      response: {
        amount: 12_345,
        currency: 'NGN',
        status: 'success',
      },
    });
  });

  it.each([
    'HTTP_400',
    'HTTP_404',
  ])('classifies Paystack %s reference failures as terminal', async (code) => {
    mocks.verifyPaystackPayment.mockResolvedValue({
      code,
      error: 'Unknown transaction reference',
      success: false,
    });

    await expect(
      verifyGatewayCharge('paystack', 'missing-ref')
    ).resolves.toEqual({ ok: false, reason: 'gateway_reference_invalid' });
  });

  it.each([
    'HTTP_400',
    'HTTP_404',
  ])('classifies Korapay %s reference failures as terminal', async (code) => {
    mocks.verifyKorapayPayment.mockResolvedValue({
      code,
      error: 'Charge not found',
      success: false,
    });

    await expect(
      verifyGatewayCharge('korapay', 'missing-ref')
    ).resolves.toEqual({ ok: false, reason: 'gateway_reference_invalid' });
  });

  it('keeps gateway 5xx failures retryable', async () => {
    mocks.verifyPaystackPayment.mockResolvedValue({
      code: 'HTTP_503',
      error: 'Unavailable',
      success: false,
    });

    await expect(verifyGatewayCharge('paystack', 'retry-ref')).resolves.toEqual(
      {
        ok: false,
        reason: 'paystack_verification_unavailable',
      }
    );
  });
});
