import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  verifyTransaction: vi.fn(),
  extractVerifiedGatewayFeeNgn: vi.fn(),
  calculatePlatformFee: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('@/lib/paystack', () => ({
  verifyTransaction: mocks.verifyTransaction,
  calculatePlatformFee: mocks.calculatePlatformFee,
}));
vi.mock('@/lib/payments/verified-gateway-fee', () => ({
  extractVerifiedGatewayFeeNgn: mocks.extractVerifiedGatewayFeeNgn,
}));

import { runReconcilePaystackUnmatchedPartialCli } from './reconcile-paystack-unmatched-partial';

const args = [
  '--review-id',
  '11111111-1111-4111-8111-111111111111',
  '--canonical-order-id',
  '22222222-2222-4222-8222-222222222222',
  '--merchant-id',
  '33333333-3333-4333-8333-333333333333',
  '--operator-user-id',
  '44444444-4444-4444-8444-444444444444',
  '--paystack-reference',
  'paystack-reference-1',
];

describe('runReconcilePaystackUnmatchedPartialCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails closed when Paystack does not verify the reference as successful', async () => {
    mocks.verifyTransaction.mockResolvedValue({
      success: true,
      data: { status: 'pending', currency: 'NGN', amount: 100 },
    });

    await expect(runReconcilePaystackUnmatchedPartialCli(args)).resolves.toBe(1);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});
