import { act, fireEvent, render, screen } from '@testing-library/react';
import { Suspense, startTransition, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsState } from '@/lib/analytics-config-diff';
import { useAnalyticsConfigForm } from './useAnalyticsConfigForm';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  invalidateAnalyticsSaveReadiness: vi.fn().mockResolvedValue(undefined),
  mutationOptions: [] as Record<string, unknown>[],
  queryClient: { setQueryData: vi.fn() },
  supabase: {
    eq: vi.fn(),
    from: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: Record<string, unknown>) => {
    mocks.mutationOptions.push(options);
    return { isPending: false, mutate: vi.fn() };
  },
  useQuery: () => ({
    data: { analytics, isOwner: true },
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useQueryClient: () => mocks.queryClient,
}));
vi.mock('react-native', () => ({ Alert: { alert: mocks.alert } }));
vi.mock('@/hooks/useMerchantScopedPending', () => ({
  useMerchantScopedPending: () => ({
    begin: vi.fn(),
    end: vi.fn(),
    isPending: () => false,
  }),
}));
vi.mock('@/lib/analytics-config-context', () => ({
  fetchAnalyticsConfigContext: vi.fn(),
}));
vi.mock('@/lib/analytics-save-readiness', () => ({
  invalidateAnalyticsSaveReadiness: (...args: unknown[]) =>
    mocks.invalidateAnalyticsSaveReadiness(...args),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.supabase.from(...args),
  },
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

describe('useAnalyticsConfigForm concurrent merchant rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutationOptions = [];
    mocks.supabase.eq.mockResolvedValue({ error: null });
    mocks.supabase.update.mockReturnValue({ eq: mocks.supabase.eq });
    mocks.supabase.from.mockReturnValue({ update: mocks.supabase.update });
  });

  it('keeps merchant A save completion active when a merchant B render is abandoned', async () => {
    const suspendedMerchantRender = new Promise<never>(() => undefined);

    function AnalyticsControls({
      merchantId,
      suspend,
    }: {
      merchantId: string;
      suspend: boolean;
    }) {
      useAnalyticsConfigForm({
        hasGrowthIntegrations: true,
        isSetupOrigin: false,
        merchantId,
        onBack: vi.fn(),
        userId: 'user-1',
      });
      if (suspend) throw suspendedMerchantRender;
      return <span>Merchant {merchantId}</span>;
    }

    function Scenario() {
      const [merchantId, setMerchantId] = useState('merchant-a');
      return (
        <>
          <button
            onClick={() => {
              startTransition(() => setMerchantId('merchant-b'));
            }}
            type="button"
          >
            Switch merchant
          </button>
          <Suspense fallback={<span>Loading merchant B</span>}>
            <AnalyticsControls
              merchantId={merchantId}
              suspend={merchantId === 'merchant-b'}
            />
          </Suspense>
        </>
      );
    }

    render(<Scenario />);
    const merchantAMutation = mocks.mutationOptions.at(-1) as
      | {
          onMutate?: () => { merchantId?: string; userId?: string };
          onSuccess?: (
            saved: AnalyticsState,
            variables: unknown,
            context: { merchantId?: string; userId?: string }
          ) => Promise<void>;
        }
      | undefined;
    const context = merchantAMutation?.onMutate?.();
    expect(context).toEqual({ merchantId: 'merchant-a', userId: 'user-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Switch merchant' }));
    expect(screen.getByText('Merchant merchant-a')).toBeTruthy();

    await act(async () => {
      await merchantAMutation?.onSuccess?.(analytics, undefined, context ?? {});
    });

    expect(mocks.alert).toHaveBeenCalledWith(
      'Success',
      'Analytics settings saved!',
      expect.any(Array)
    );
  });

  it('keeps merchant A draft in its save payload when a merchant B render is abandoned', async () => {
    const suspendedMerchantRender = new Promise<never>(() => undefined);

    function AnalyticsControls({
      merchantId,
      suspend,
    }: {
      merchantId: string;
      suspend: boolean;
    }) {
      const { updateField } = useAnalyticsConfigForm({
        hasGrowthIntegrations: true,
        isSetupOrigin: false,
        merchantId,
        onBack: vi.fn(),
        userId: 'user-1',
      });
      if (suspend) throw suspendedMerchantRender;
      return (
        <button
          onClick={() => updateField('facebook_pixel_id', 'A-DRAFT-PIXEL')}
          type="button"
        >
          Edit merchant A draft
        </button>
      );
    }

    function Scenario() {
      const [merchantId, setMerchantId] = useState('merchant-a');
      return (
        <>
          <button
            onClick={() => {
              startTransition(() => setMerchantId('merchant-b'));
            }}
            type="button"
          >
            Switch merchant
          </button>
          <Suspense fallback={<span>Loading merchant B</span>}>
            <AnalyticsControls
              merchantId={merchantId}
              suspend={merchantId === 'merchant-b'}
            />
          </Suspense>
        </>
      );
    }

    render(<Scenario />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit merchant A draft' })
    );
    const merchantAMutation = mocks.mutationOptions.at(-1) as
      | { mutationFn?: () => Promise<AnalyticsState> }
      | undefined;

    fireEvent.click(screen.getByRole('button', { name: 'Switch merchant' }));

    await act(async () => {
      await merchantAMutation?.mutationFn?.();
    });

    expect(mocks.supabase.update).toHaveBeenCalledWith({
      facebook_pixel_id: 'A-DRAFT-PIXEL',
    });
    expect(mocks.supabase.eq).toHaveBeenCalledWith('id', 'merchant-a');
  });
});
