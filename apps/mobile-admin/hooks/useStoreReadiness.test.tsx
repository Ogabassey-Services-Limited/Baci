import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const merchantId = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
  getMerchant: vi.fn(),
  refetchMerchant: vi.fn(),
  supabaseFrom: vi.fn(),
  supabaseRpc: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({ apiClient: mocks.apiClient }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.supabaseFrom,
    rpc: mocks.supabaseRpc,
  },
}));

vi.mock('./useMerchant', () => ({
  useMerchant: () => mocks.getMerchant(),
}));

const { useStoreReadiness } = await import('./useStoreReadiness');

function readiness(completed: boolean) {
  return {
    merchantId,
    surface: 'mobile',
    isReady: completed,
    isPublished: false,
    completedRequired: completed ? 1 : 0,
    totalRequired: 1,
    completedRecommended: 0,
    totalRecommended: 0,
    overallProgress: completed ? 100 : 0,
    items: [
      {
        id: 'bank_account',
        label: 'Add bank account',
        description: 'Required to receive payments via Paystack',
        completed,
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
  };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('useStoreReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMerchant.mockReturnValue({
      merchant: { id: merchantId },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: mocks.refetchMerchant,
    });
  });

  it('uses newly fetched server readiness without refreshing merchant context', async () => {
    mocks.apiClient
      .mockResolvedValueOnce(readiness(false))
      .mockResolvedValueOnce(readiness(true));

    const { result } = renderHook(() => useStoreReadiness(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.readiness?.items[0]?.completed).toBe(false);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.readiness?.items[0]?.completed).toBe(true);
    });
    expect(mocks.refetchMerchant).not.toHaveBeenCalled();
    expect(mocks.apiClient).toHaveBeenCalledTimes(2);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
    expect(mocks.supabaseRpc).not.toHaveBeenCalled();
  });

  it('retries the existing merchant readiness request after it fails', async () => {
    mocks.apiClient
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(readiness(true));

    const { result } = renderHook(() => useStoreReadiness(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(new Error('offline'));
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.readiness?.isReady).toBe(true);
    });
    expect(mocks.refetchMerchant).not.toHaveBeenCalled();
  });

  it('retries merchant context before enabling its canonical readiness query', async () => {
    mocks.getMerchant.mockReturnValue({
      merchant: null,
      isLoading: false,
      isFetching: false,
      error: new Error('merchant offline'),
      refetch: mocks.refetchMerchant,
    });
    mocks.refetchMerchant.mockImplementation(async () => {
      mocks.getMerchant.mockReturnValue({
        merchant: { id: merchantId },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: mocks.refetchMerchant,
      });
    });
    mocks.apiClient.mockResolvedValueOnce(readiness(true));
    const wrapper = createWrapper();

    const { result, rerender } = renderHook(() => useStoreReadiness(), {
      wrapper,
    });

    await result.current.refetch();
    expect(mocks.refetchMerchant).toHaveBeenCalledTimes(1);
    expect(mocks.apiClient).not.toHaveBeenCalled();

    rerender();

    await waitFor(() => {
      expect(result.current.readiness?.isReady).toBe(true);
    });
    expect(mocks.apiClient).toHaveBeenCalledWith(
      `/api/merchant/readiness?merchantId=${merchantId}&surface=mobile`,
      { signal: expect.any(AbortSignal) }
    );
  });

  it('keeps retry busy while merchant context is fetching', () => {
    mocks.getMerchant.mockReturnValue({
      merchant: null,
      isLoading: false,
      isFetching: true,
      error: null,
      refetch: mocks.refetchMerchant,
    });

    const { result } = renderHook(() => useStoreReadiness(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(true);
  });
});
