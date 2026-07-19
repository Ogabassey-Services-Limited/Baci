import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isTerminalGatewayVerificationReason,
  verifyGatewayCharge,
} from '@/lib/payments/verify-gateway-charge';

const mocks = vi.hoisted(() => ({
  getJuicywaySession: vi.fn(),
  verifyKorapayPayment: vi.fn(),
  verifyPaystackPayment: vi.fn(),
}));

vi.mock('@/lib/juicyway', () => ({
  getPaymentSession: mocks.getJuicywaySession,
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

  it.each([
    { amount: undefined, currency: 'NGN' },
    { amount: Number.NaN, currency: 'NGN' },
    { amount: 12_345, currency: undefined },
  ])('rejects incomplete Paystack success evidence: %j', async (data) => {
    mocks.verifyPaystackPayment.mockResolvedValue({
      data: { ...data, status: 'success' },
      success: true,
    });

    await expect(
      verifyGatewayCharge('paystack', 'partial-ref')
    ).resolves.toEqual({
      ok: false,
      reason: 'paystack_verification_invalid_payload',
    });
  });

  it('rejects incomplete Korapay success evidence', async () => {
    mocks.verifyKorapayPayment.mockResolvedValue({
      data: { amount: 1000, status: 'success' },
      success: true,
    });

    await expect(
      verifyGatewayCharge('korapay', 'partial-ref')
    ).resolves.toEqual({
      ok: false,
      reason: 'korapay_verification_invalid_payload',
    });
  });

  it('verifies a succeeded Juicyway session against its locked settlement metadata', async () => {
    mocks.getJuicywaySession.mockResolvedValue({
      data: {
        id: 'session-1',
        payment: {
          amount: 50_000,
          currency: 'USDT',
          id: 'payment-1',
          status: 'succeeded',
        },
        status: 'succeeded',
      },
      success: true,
    });

    await expect(
      verifyGatewayCharge('juicyway', 'BAC-JUICY', {
        juicywayExpectedAmount: 50_000,
        juicywayExpectedCurrency: 'USDT',
        juicywaySessionId: 'session-1',
      })
    ).resolves.toEqual({
      amount: 50_000,
      currency: 'USDT',
      ok: true,
      response: {
        id: 'session-1',
        payment: {
          amount: 50_000,
          currency: 'USDT',
          id: 'payment-1',
          status: 'succeeded',
        },
        status: 'succeeded',
      },
    });
    expect(mocks.getJuicywaySession).toHaveBeenCalledWith('session-1');
  });

  it('keeps a Juicyway session pending so the next sweep retries it', async () => {
    mocks.getJuicywaySession.mockResolvedValue({
      data: {
        id: 'session-1',
        payment: {
          amount: 50_000,
          currency: 'USDT',
          id: 'payment-1',
          status: 'processing',
        },
        status: 'processing',
      },
      success: true,
    });

    await expect(
      verifyGatewayCharge('juicyway', 'BAC-JUICY', {
        juicywayExpectedAmount: 50_000,
        juicywayExpectedCurrency: 'USDT',
        juicywaySessionId: 'session-1',
      })
    ).resolves.toEqual({
      gatewayStatus: 'processing',
      ok: false,
      reason: 'juicyway_payment_pending',
    });
  });

  it('rejects an underpaid Juicyway session', async () => {
    mocks.getJuicywaySession.mockResolvedValue({
      data: {
        id: 'session-1',
        payment: {
          amount: 48_000,
          currency: 'USDT',
          id: 'payment-1',
          status: 'succeeded',
        },
        status: 'succeeded',
      },
      success: true,
    });

    await expect(
      verifyGatewayCharge('juicyway', 'BAC-JUICY', {
        juicywayExpectedAmount: 50_000,
        juicywayExpectedCurrency: 'USDT',
        juicywaySessionId: 'session-1',
      })
    ).resolves.toEqual({ ok: false, reason: 'amount_mismatch' });
  });

  it.each([
    { expectedResult: 'success', settledAmount: 49_500 },
    { expectedResult: 'amount_mismatch', settledAmount: 49_499 },
  ])('classifies $settledAmount at the one-percent underpayment boundary', async ({
    expectedResult,
    settledAmount,
  }) => {
    mocks.getJuicywaySession.mockResolvedValue({
      data: {
        id: 'session-1',
        payment: {
          amount: settledAmount,
          currency: 'USDT',
          id: 'payment-1',
          status: 'succeeded',
        },
        status: 'succeeded',
      },
      success: true,
    });

    const result = await verifyGatewayCharge('juicyway', 'BAC-JUICY', {
      juicywayExpectedAmount: 50_000,
      juicywayExpectedCurrency: 'USDT',
      juicywaySessionId: 'session-1',
    });

    expect(result).toEqual(
      expectedResult === 'success'
        ? {
            amount: settledAmount,
            currency: 'USDT',
            ok: true,
            response: {
              id: 'session-1',
              payment: {
                amount: settledAmount,
                currency: 'USDT',
                id: 'payment-1',
                status: 'succeeded',
              },
              status: 'succeeded',
            },
          }
        : { ok: false, reason: expectedResult }
    );
  });

  it('fails closed when Juicyway reconciliation metadata is missing', async () => {
    await expect(verifyGatewayCharge('juicyway', 'BAC-JUICY')).resolves.toEqual(
      {
        ok: false,
        reason: 'juicyway_verification_context_missing',
      }
    );
    expect(mocks.getJuicywaySession).not.toHaveBeenCalled();
  });

  it.each([
    'juicyway_verification_invalid_payload',
    'korapay_verification_invalid_payload',
    'paystack_verification_invalid_payload',
  ])('treats %s as a terminal review condition', (reason) => {
    expect(isTerminalGatewayVerificationReason(reason)).toBe(true);
  });
});
