import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsState } from '@/lib/analytics-config-diff';
import { useAnalyticsConfigForm } from './useAnalyticsConfigForm';

const queryMocks = vi.hoisted(() => ({ useQuery: vi.fn() }));
const mutationMocks = vi.hoisted(() => ({ useMutation: vi.fn() }));
const queryClientMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
}));
const analyticsContextMocks = vi.hoisted(() => ({
  fetchAnalyticsConfigContext: vi.fn(),
}));
const supabaseMocks = vi.hoisted(() => {
  const eq = vi.fn(() => ({ error: null }));
  const update = vi.fn(() => ({ eq }));
  return { eq, from: vi.fn(() => ({ update })), update };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: mutationMocks.useMutation,
  useQuery: queryMocks.useQuery,
  useQueryClient: () => queryClientMocks,
}));
vi.mock('@/constants/store-readiness-routes', () => ({
  isStoreReadinessSetupOrigin: vi.fn(() => false),
}));
vi.mock('@/lib/analytics-config-context', () => analyticsContextMocks);
vi.mock('@/lib/analytics-save-readiness', () => ({
  invalidateAnalyticsSaveReadiness: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { from: supabaseMocks.from },
}));

const analytics: AnalyticsState = {
  facebook_capi_token: '',
  facebook_pixel_id: '',
  ga4_api_secret: '',
  google_analytics_id: '',
  offline_conversions_enabled: true,
  snapchat_capi_token: '',
  snapchat_pixel_id: '',
  tiktok_access_token: '',
  tiktok_pixel_id: '',
};

describe('useAnalyticsConfigForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyticsContextMocks.fetchAnalyticsConfigContext.mockResolvedValue(
      undefined
    );
    queryMocks.useQuery.mockReturnValue({
      data: { analytics, isOwner: true },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    mutationMocks.useMutation.mockImplementation((options) => ({
      isPending: false,
      mutate: vi.fn(),
      options,
    }));
  });

  it('loads the active merchant rather than relying on a user-selected default merchant', async () => {
    const { result } = renderHook(() =>
      useAnalyticsConfigForm({
        hasGrowthIntegrations: true,
        isSetupOrigin: false,
        merchantId: 'merchant-b',
        onBack: vi.fn(),
        userId: 'user-1',
      })
    );
    const queryOptions = queryMocks.useQuery.mock.calls.at(-1)?.[0];

    await expect(queryOptions.queryFn()).resolves.toBeUndefined();

    expect(queryOptions.queryKey).toEqual([
      'merchant-analytics-full',
      'user-1',
      'merchant-b',
    ]);
    expect(
      analyticsContextMocks.fetchAnalyticsConfigContext
    ).toHaveBeenCalledWith('merchant-b');
    expect(result.current.canManageAnalytics).toBe(true);
  });

  it('writes the dirty analytics diff to the active merchant id', async () => {
    renderHook(() =>
      useAnalyticsConfigForm({
        hasGrowthIntegrations: true,
        isSetupOrigin: false,
        merchantId: 'merchant-b',
        onBack: vi.fn(),
        userId: 'user-1',
      })
    );
    const mutationOptions = mutationMocks.useMutation.mock.calls.at(-1)?.[0];

    await act(async () => {
      await mutationOptions.mutationFn({
        ...analytics,
        facebook_pixel_id: 'PIXEL-B',
      });
    });

    expect(supabaseMocks.update).toHaveBeenCalledWith({
      facebook_pixel_id: 'PIXEL-B',
    });
    expect(supabaseMocks.eq).toHaveBeenCalledWith('id', 'merchant-b');
  });

  it('does not render or save merchant A draft values while merchant B is loading', async () => {
    const { result, rerender } = renderHook(
      ({ merchantId }) =>
        useAnalyticsConfigForm({
          hasGrowthIntegrations: true,
          isSetupOrigin: false,
          merchantId,
          onBack: vi.fn(),
          userId: 'user-1',
        }),
      { initialProps: { merchantId: 'merchant-a' } }
    );

    act(() => {
      result.current.updateField('facebook_pixel_id', 'A-DRAFT-PIXEL');
    });
    queryMocks.useQuery.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: true,
      refetch: vi.fn(),
    });
    rerender({ merchantId: 'merchant-b' });

    expect(result.current.analytics.facebook_pixel_id).toBe('');
    const mutationOptions = mutationMocks.useMutation.mock.calls.at(-1)?.[0];
    await expect(mutationOptions.mutationFn()).rejects.toThrow(
      'Analytics settings are still loading. Please try again.'
    );
    expect(supabaseMocks.update).not.toHaveBeenCalled();
  });

  it('does not expose merchant A save pending state after switching to merchant B', () => {
    let mutationPending = false;
    mutationMocks.useMutation.mockImplementation((options) => ({
      isPending: mutationPending,
      mutate: vi.fn(),
      options,
    }));
    const { result, rerender } = renderHook(
      ({ merchantId }) =>
        useAnalyticsConfigForm({
          hasGrowthIntegrations: true,
          isSetupOrigin: false,
          merchantId,
          onBack: vi.fn(),
          userId: 'user-1',
        }),
      { initialProps: { merchantId: 'merchant-a' } }
    );
    const merchantAMutation = mutationMocks.useMutation.mock.calls.at(-1)?.[0];

    mutationPending = true;
    act(() => {
      merchantAMutation.onMutate();
      rerender({ merchantId: 'merchant-a' });
    });
    expect(result.current.isSavePending).toBe(true);

    rerender({ merchantId: 'merchant-b' });

    expect(result.current.isSavePending).toBe(false);
  });

  it("does not expose another user's save pending state for the same merchant", () => {
    let mutationPending = false;
    mutationMocks.useMutation.mockImplementation((options) => ({
      isPending: mutationPending,
      mutate: vi.fn(),
      options,
    }));
    const { result, rerender } = renderHook(
      ({ userId }) =>
        useAnalyticsConfigForm({
          hasGrowthIntegrations: true,
          isSetupOrigin: false,
          merchantId: 'merchant-a',
          onBack: vi.fn(),
          userId,
        }),
      { initialProps: { userId: 'user-1' } }
    );
    const firstUserMutation = mutationMocks.useMutation.mock.calls.at(-1)?.[0];

    mutationPending = true;
    act(() => {
      firstUserMutation.onMutate();
      rerender({ userId: 'user-1' });
    });
    expect(result.current.isSavePending).toBe(true);

    rerender({ userId: 'user-2' });

    expect(result.current.isSavePending).toBe(false);
  });
});
