import type { QueryFunctionContext } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiClient: mocks.apiClient,
}));

import {
  storeReadinessKeys,
  storeReadinessOptions,
} from './store-readiness-query';

const merchantId = '11111111-1111-4111-8111-111111111111';

function createReadiness(overrides: Record<string, unknown> = {}) {
  return {
    merchantId,
    surface: 'mobile',
    isReady: false,
    isPublished: false,
    completedRequired: 0,
    totalRequired: 1,
    completedRecommended: 0,
    totalRecommended: 0,
    overallProgress: 0,
    items: [
      {
        id: 'bank_account',
        label: 'Add bank account',
        description: 'Required to receive payments via Paystack',
        completed: false,
        priority: 'required',
        category: 'payments',
      },
    ],
    storeBuild: {
      starterStoreReady: true,
      aiStatus: 'not_started',
      latestJobId: null,
      canApplyAiDraft: false,
      message: 'Starter storefront is ready.',
    },
    ...overrides,
  };
}

function queryContext(): QueryFunctionContext<
  ReturnType<typeof storeReadinessKeys.detail>
> {
  return {
    client: {} as QueryFunctionContext<
      ReturnType<typeof storeReadinessKeys.detail>
    >['client'],
    queryKey: storeReadinessKeys.detail(merchantId),
    signal: new AbortController().signal,
    meta: undefined,
  };
}

function readinessQuery() {
  const queryFn = storeReadinessOptions(merchantId).queryFn;
  if (!queryFn) {
    throw new Error('Store readiness query function is required');
  }
  return queryFn;
}

describe('store readiness query options', () => {
  it('keys readiness by the active mobile merchant only', () => {
    expect(storeReadinessKeys.detail(merchantId)).toEqual([
      'store-readiness',
      'mobile',
      merchantId,
    ]);
  });

  it('requests the canonical mobile readiness endpoint', async () => {
    mocks.apiClient.mockResolvedValueOnce(createReadiness());

    await readinessQuery()(queryContext());

    expect(mocks.apiClient).toHaveBeenCalledWith(
      `/api/merchant/readiness?merchantId=${merchantId}&surface=mobile`,
      { signal: expect.any(AbortSignal) }
    );
  });

  it.each([
    [
      'an unknown item id',
      createReadiness({
        items: [{ ...createReadiness().items[0], id: 'unknown_item' }],
      }),
    ],
    [
      'a response for another merchant',
      createReadiness({ merchantId: 'other' }),
    ],
    ['a web response', createReadiness({ surface: 'web' })],
  ])('rejects %s before it enters the mobile cache', async (_case, response) => {
    mocks.apiClient.mockResolvedValueOnce(response);

    await expect(readinessQuery()(queryContext())).rejects.toThrow(
      'Invalid store readiness response'
    );
  });
});
