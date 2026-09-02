import { describe, expect, it, vi } from 'vitest';

const failAssignment = vi.hoisted(() => vi.fn());
vi.mock('./merchant-wallet-assignment-events', () => ({
  failMerchantWalletAssignmentEvent: failAssignment,
}));

const { handlePaystackMerchantWalletAssignmentFailure } = await import(
  './paystack-merchant-wallet-assignment-failure-webhook'
);

describe('Paystack merchant-wallet assignment failure webhook', () => {
  it.each([
    [
      { kind: 'match' },
      200,
      { success: true, handled: 'merchant_wallet_assignment_failure' },
    ],
    [{ kind: 'ignored' }, 200, { message: 'Event ignored' }],
    [
      { kind: 'review' },
      409,
      {
        error: 'Paystack assignment failure accepted for review',
        code: 'MERCHANT_WALLET_ASSIGNMENT_FAILURE_REVIEW',
      },
    ],
  ] as const)('returns the %s outcome safely', async (outcome, status, body) => {
    failAssignment.mockResolvedValueOnce(outcome);

    const response = await handlePaystackMerchantWalletAssignmentFailure(
      {} as never,
      { event: 'dedicatedaccount.assign.failed' }
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
  });
});
