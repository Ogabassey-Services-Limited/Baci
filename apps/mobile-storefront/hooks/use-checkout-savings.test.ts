import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { SavingsGoal } from '@/lib/customer-savings';
import { useCheckoutSavings } from './use-checkout-savings';

const mockListSavingsGoals =
  jest.fn<(...args: unknown[]) => Promise<{ goals: SavingsGoal[] }>>();
const mockTrackError = jest.fn();

jest.mock('@/lib/customer-savings', () => ({
  listSavingsGoals: (...args: unknown[]) => mockListSavingsGoals(...args),
}));

jest.mock('@/services/analytics', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

function createGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    breakFeePercent: 3,
    contributionAmount: 20_000,
    contributionFrequency: 'daily',
    currentAmount: 150_000,
    id: 'goal-1',
    maturityDate: '2026-06-30',
    productId: 'product-1',
    sourceMode: 'manual',
    startDate: '2026-05-24',
    status: 'active',
    targetAmount: 800_000,
    title: 'iPhone 13 Pro Max',
    variantId: null,
    ...overrides,
  };
}

describe('useCheckoutSavings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListSavingsGoals.mockResolvedValue({
      goals: [createGoal()],
    });
  });

  it('loads eligible savings goals for authenticated checkout customers', async () => {
    const { result } = renderHook(() =>
      useCheckoutSavings({
        customerId: 'customer-1',
        isAuthenticated: true,
        items: [{ product_id: 'product-1', variant_id: null }],
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
      })
    );

    await waitFor(() => expect(result.current.savingsGoals).toHaveLength(1));

    expect(mockListSavingsGoals).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      signal: expect.any(AbortSignal),
    });
    expect(result.current.checkoutSavingsGoal?.id).toBe('goal-1');
    expect(result.current.checkoutSavingsBalance).toBe(150_000);
    expect(result.current.isLoadingCheckoutSavings).toBe(false);
  });

  it('clears savings state when checkout is not authenticated', () => {
    const { result } = renderHook(() =>
      useCheckoutSavings({
        customerId: null,
        isAuthenticated: false,
        items: [{ product_id: 'product-1', variant_id: null }],
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
      })
    );

    expect(result.current.savingsGoals).toEqual([]);
    expect(result.current.savingsSelection).toBeUndefined();
    expect(result.current.checkoutSavingsError).toBeNull();
    expect(mockListSavingsGoals).not.toHaveBeenCalled();
  });

  it('clears stale selection when the eligible cart goal changes', async () => {
    const { result, rerender } = renderHook(
      ({ productId }: { productId: string }) =>
        useCheckoutSavings({
          customerId: 'customer-1',
          isAuthenticated: true,
          items: [{ product_id: productId, variant_id: null }],
          merchantId: 'merchant-1',
          merchantSlug: 'ogabassey',
        }),
      { initialProps: { productId: 'product-1' } }
    );

    await waitFor(() =>
      expect(result.current.checkoutSavingsGoal?.id).toBe('goal-1')
    );

    act(() => {
      result.current.setSavingsSelection({
        amount: 50_000,
        goalId: 'goal-1',
        use: true,
      });
    });
    rerender({ productId: 'other-product' });

    await waitFor(() =>
      expect(result.current.savingsSelection).toBeUndefined()
    );
  });

  it('clears selected savings when refetch removes spendable balance', async () => {
    mockListSavingsGoals
      .mockResolvedValueOnce({ goals: [createGoal()] })
      .mockResolvedValueOnce({
        goals: [createGoal({ currentAmount: 0 })],
      });
    const { result } = renderHook(() =>
      useCheckoutSavings({
        customerId: 'customer-1',
        isAuthenticated: true,
        items: [{ product_id: 'product-1', variant_id: null }],
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
      })
    );

    await waitFor(() =>
      expect(result.current.checkoutSavingsGoal?.id).toBe('goal-1')
    );

    act(() => {
      result.current.setSavingsSelection({
        amount: 50_000,
        goalId: 'goal-1',
        use: true,
      });
      result.current.reloadCheckoutSavings();
    });

    await waitFor(() =>
      expect(result.current.savingsSelection).toBeUndefined()
    );
    expect(result.current.checkoutSavingsGoal).toBeNull();
    expect(
      result.current.getLiveSavingsSelection({
        isStoreCreditCompatible: true,
        items: [{ product_id: 'product-1', variant_id: null }],
        orderTotal: 120_000,
      })
    ).toBeUndefined();
  });

  it('builds submit-time savings selection from the latest eligible goal', async () => {
    const checkoutItems = [{ product_id: 'product-1', variant_id: null }];
    const { result } = renderHook(() =>
      useCheckoutSavings({
        customerId: 'customer-1',
        isAuthenticated: true,
        items: checkoutItems,
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
      })
    );

    await waitFor(() =>
      expect(result.current.checkoutSavingsGoal?.id).toBe('goal-1')
    );

    act(() => {
      result.current.setSavingsSelection({
        amount: 50_000,
        goalId: 'goal-1',
        use: true,
      });
    });

    expect(
      result.current.getLiveSavingsSelection({
        isStoreCreditCompatible: true,
        items: checkoutItems,
        orderTotal: 120_000,
      })
    ).toEqual({
      amount: 120_000,
      goalId: 'goal-1',
      use: true,
    });
    expect(
      result.current.getLiveSavingsSelection({
        isStoreCreditCompatible: true,
        items: [{ product_id: 'product-1', variant_id: null }],
        orderTotal: 120_000,
      })
    ).toEqual({
      amount: 120_000,
      goalId: 'goal-1',
      use: true,
    });
    expect(
      result.current.getLiveSavingsSelection({
        isStoreCreditCompatible: false,
        items: [{ product_id: 'product-1', variant_id: null }],
        orderTotal: 120_000,
      })
    ).toBeUndefined();
  });

  it('surfaces non-retryable load failures with a category and retries on demand', async () => {
    mockListSavingsGoals
      .mockRejectedValueOnce(new Error('HTTP 422: Savings unavailable'))
      .mockResolvedValueOnce({ goals: [createGoal()] });
    const { result } = renderHook(() =>
      useCheckoutSavings({
        customerId: 'customer-1',
        isAuthenticated: true,
        items: [{ product_id: 'product-1', variant_id: null }],
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
      })
    );

    await waitFor(() =>
      expect(result.current.checkoutSavingsError).toBe(
        'HTTP 422: Savings unavailable'
      )
    );
    expect(mockListSavingsGoals).toHaveBeenCalledTimes(1);
    expect(mockTrackError).toHaveBeenCalledWith(
      'checkout_savings_goals_fetch',
      'HTTP 422: Savings unavailable',
      expect.objectContaining({
        error_category: 'http_client',
        error_retryable: false,
        merchant_slug: 'ogabassey',
        reload_attempt: 0,
        retry_count: 0,
      })
    );

    act(() => {
      result.current.reloadCheckoutSavings();
    });

    await waitFor(() => expect(result.current.savingsGoals).toHaveLength(1));
    expect(result.current.checkoutSavingsError).toBeNull();
  });

  it('auto-retries transient DNS failures without reporting an error', async () => {
    jest.useFakeTimers();
    try {
      mockListSavingsGoals
        .mockRejectedValueOnce(
          new Error(
            'fetch failed: java.net.UnknownHostException: Unable to resolve host "usebaci.com": No address associated with hostname'
          )
        )
        .mockResolvedValueOnce({ goals: [createGoal()] });
      const { result } = renderHook(() =>
        useCheckoutSavings({
          customerId: 'customer-1',
          isAuthenticated: true,
          items: [{ product_id: 'product-1', variant_id: null }],
          merchantId: 'merchant-1',
          merchantSlug: 'ogabassey',
        })
      );

      // Let the first attempt fail and the backoff delay elapse
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1_500);
      });

      await waitFor(() => expect(result.current.savingsGoals).toHaveLength(1));
      expect(mockListSavingsGoals).toHaveBeenCalledTimes(2);
      expect(result.current.checkoutSavingsError).toBeNull();
      expect(mockTrackError).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports one classified error after transient retries are exhausted', async () => {
    jest.useFakeTimers();
    try {
      mockListSavingsGoals.mockRejectedValue(
        new Error(
          'fetch failed: java.net.UnknownHostException: Unable to resolve host "usebaci.com": No address associated with hostname'
        )
      );
      const { result } = renderHook(() =>
        useCheckoutSavings({
          customerId: 'customer-1',
          isAuthenticated: true,
          items: [{ product_id: 'product-1', variant_id: null }],
          merchantId: 'merchant-1',
          merchantSlug: 'ogabassey',
        })
      );

      // Exhaust both backoff delays (1.5s, then 3s)
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1_500);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3_000);
      });

      await waitFor(() =>
        expect(result.current.checkoutSavingsError).not.toBeNull()
      );
      expect(mockListSavingsGoals).toHaveBeenCalledTimes(3);
      expect(mockTrackError).toHaveBeenCalledTimes(1);
      expect(mockTrackError).toHaveBeenCalledWith(
        'checkout_savings_goals_fetch',
        expect.stringContaining('UnknownHostException'),
        expect.objectContaining({
          error_category: 'dns',
          error_retryable: true,
          retry_count: 2,
        })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not track fetch errors after unmount cancellation', async () => {
    let rejectGoals: (error: Error) => void = () => undefined;
    mockListSavingsGoals.mockReturnValue(
      new Promise((_, reject) => {
        rejectGoals = reject;
      })
    );
    const { unmount } = renderHook(() =>
      useCheckoutSavings({
        customerId: 'customer-1',
        isAuthenticated: true,
        items: [{ product_id: 'product-1', variant_id: null }],
        merchantId: 'merchant-1',
        merchantSlug: 'ogabassey',
      })
    );

    unmount();

    await act(async () => {
      rejectGoals(new Error('Cancelled request failed'));
      await Promise.resolve();
    });

    expect(mockTrackError).not.toHaveBeenCalled();
  });
});
