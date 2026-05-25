import { describe, expect, it } from '@jest/globals';
import {
  mockFetchWithTimeout,
  mockGetSession,
} from '@/lib/wallet-top-up.test-utils';

const {
  addSavingsContribution,
  cancelSavingsGoalFutureDebits,
  confirmSavingsAuthorization,
  createSavingsGoal,
  initializeSavingsAuthorization,
  listCustomerPaymentMethods,
  listSavingsGoals,
  pauseSavingsGoal,
  resumeSavingsGoal,
} =
  require('@/lib/customer-savings') as typeof import('@/lib/customer-savings');

const goalId = '00000000-0000-4000-8000-000000000001';

const savingsApiCases = [
  {
    name: 'listSavingsGoals',
    run: () => listSavingsGoals({ merchantSlug: 'ogabassey' }),
  },
  {
    name: 'listCustomerPaymentMethods',
    run: () => listCustomerPaymentMethods({ merchantSlug: 'ogabassey' }),
  },
  {
    name: 'createSavingsGoal',
    run: () =>
      createSavingsGoal({
        contributionAmount: 20000,
        contributionFrequency: 'daily',
        maturityDate: '2026-06-30',
        nonWithdrawableAccepted: true,
        productId: 'product-1',
        sourceMode: 'manual',
        startDate: '2026-05-20',
        targetAmount: 800000,
        termsAccepted: true,
      }),
  },
  {
    name: 'addSavingsContribution',
    run: () =>
      addSavingsContribution({
        amount: 20000,
        goalId,
        idempotencyKey: 'idem-1',
        merchantSlug: 'ogabassey',
      }),
  },
  {
    name: 'pauseSavingsGoal',
    run: () => pauseSavingsGoal({ goalId, merchantSlug: 'ogabassey' }),
  },
  {
    name: 'resumeSavingsGoal',
    run: () => resumeSavingsGoal({ goalId, merchantSlug: 'ogabassey' }),
  },
  {
    name: 'cancelSavingsGoalFutureDebits',
    run: () =>
      cancelSavingsGoalFutureDebits({ goalId, merchantSlug: 'ogabassey' }),
  },
  {
    name: 'initializeSavingsAuthorization',
    run: () =>
      initializeSavingsAuthorization({
        amount: 100,
        merchantSlug: 'ogabassey',
      }),
  },
  {
    name: 'confirmSavingsAuthorization',
    run: () =>
      confirmSavingsAuthorization({
        merchantSlug: 'ogabassey',
        reference: 'SAV-AUTH-123',
      }),
  },
] as const;

describe('customer savings api client errors', () => {
  it('throws when auth session token is unavailable', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(
      initializeSavingsAuthorization({ amount: 100 })
    ).rejects.toThrow('Authentication required. Please sign in again.');
  });

  describe.each(savingsApiCases)('$name', ({ run }) => {
    it.each([
      [400, 'Bad Request', 'Invalid savings request.'],
      [401, 'Unauthorized', 'Authentication required.'],
      [500, 'Internal Server Error', 'Savings service failed.'],
    ])('throws the server error message for HTTP %i responses', async (status, statusText, errorMessage) => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: false,
        status,
        statusText,
        json: async () => ({
          error: errorMessage,
        }),
      });

      await expect(run()).rejects.toThrow(errorMessage);
    });

    it('propagates network failures', async () => {
      mockFetchWithTimeout.mockRejectedValue(new Error('Network unavailable'));

      await expect(run()).rejects.toThrow('Network unavailable');
    });
  });

  it('throws when the API response is not valid JSON', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new Error('Unexpected token');
      },
    });

    await expect(listSavingsGoals({})).rejects.toThrow(
      'Invalid server response (200 OK): Unexpected token'
    );
  });

  it('throws when a successful API payload does not match the savings schema', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        goals: [
          {
            breakFeePercent: 0,
            contributionAmount: 20000,
            contributionFrequency: 'daily',
            currentAmount: '120000',
            id: 'goal-1',
            maturityDate: '2026-06-30',
            productId: 'product-1',
            sourceMode: 'manual',
            startDate: '2026-05-20',
            status: 'active',
            targetAmount: 800000,
            title: 'iPhone savings',
            variantId: null,
          },
        ],
        summary: {
          activeGoalCount: 1,
          savingsBalance: 120000,
        },
      }),
    });

    await expect(listSavingsGoals({})).rejects.toThrow(
      /expected number, received string/i
    );
  });
});
