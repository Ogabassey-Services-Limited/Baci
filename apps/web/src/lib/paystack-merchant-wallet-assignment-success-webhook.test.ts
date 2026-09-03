import { describe, expect, it, vi } from 'vitest';

const persistAssignment = vi.hoisted(() => vi.fn());
vi.mock('./persist-merchant-wallet-assignment-event', () => ({
  persistMerchantWalletAssignmentEvent: persistAssignment,
}));

const { handlePaystackMerchantWalletAssignmentSuccess } = await import(
  './paystack-merchant-wallet-assignment-success-webhook'
);

describe('Paystack merchant-wallet assignment success webhook', () => {
  it.each([
    [
      { kind: 'match' },
      200,
      { success: true, handled: 'merchant_wallet_assignment' },
    ],
    [
      { kind: 'conflict' },
      200,
      { success: true, handled: 'merchant_wallet_alias_conflict' },
    ],
    [{ kind: 'ignored' }, 200, { message: 'Event ignored' }],
    [
      { kind: 'review' },
      409,
      {
        error: 'Paystack assignment accepted for review',
        code: 'MERCHANT_WALLET_ASSIGNMENT_REVIEW',
      },
    ],
  ] as const)('returns the %s outcome safely', async (outcome, status, body) => {
    persistAssignment.mockResolvedValueOnce(outcome);

    const response = await handlePaystackMerchantWalletAssignmentSuccess(
      {} as never,
      { event: 'dedicatedaccount.assign.success' }
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
  });
});
