import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Sentinel hex values so the test catches accidental reintroduction of the
// hardcoded #000000 / #fff this PR fixes. If the source goes back to
// hardcoded colors, the rendered DOM won't carry these sentinels and the
// assertions fail.
const THEME_TEXT = '#abcdef';
const THEME_TEXT_ON_PRIMARY = '#fedcba';
const queryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}));
const queryClientMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
}));
const readinessMocks = vi.hoisted(() => ({
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
}));
const accessMocks = vi.hoisted(() => ({
  useMerchant: vi.fn(),
  useRevenueCat: vi.fn(),
}));
const routeMocks = vi.hoisted(() => ({
  back: vi.fn(),
  params: {} as { from?: string },
}));

// Captures the Supabase `.update()` payload so tests can assert exactly which
// analytics fields were written (drift vector V3: a save must not rewrite
// unchanged fields, and a background refetch must not clobber typed edits).
// `from` is a spy so the regression suite can prove the read path never
// selects from merchants directly, and `rpc` drives the context RPC read.
const supabaseMocks = vi.hoisted(() => {
  const update = vi.fn(() => ({ eq: () => ({ error: null }) }));
  const from = vi.fn(() => ({ update }));
  const rpc = vi.fn(
    async (): Promise<{ data: unknown; error: Error | null }> => ({
      data: null,
      error: null,
    })
  );
  return { from, rpc, update };
});

// Drives the real mutationFn: useMutation captures the options and `mutate`
// invokes the mutationFn so the per-field dirty diff actually runs.
const mutationMocks = vi.hoisted(() => {
  type MutationOptions = {
    mutationFn: (variables?: unknown) => Promise<unknown>;
    onMutate?: () => unknown | Promise<unknown>;
    onSuccess?: (
      data?: unknown,
      variables?: unknown,
      context?: unknown
    ) => Promise<void> | void;
  };
  const state: { options: MutationOptions | null } = { options: null };
  return {
    state,
    useMutation: (options: MutationOptions) => {
      state.options = options;
      return {
        isPending: false,
        mutate: (variables?: unknown) => {
          void (async () => {
            const context = await options.onMutate?.();
            const data = await options.mutationFn(variables);
            await options.onSuccess?.(data, variables, context);
          })();
        },
      };
    },
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');

  type ViewLike = {
    children?: React.ReactNode;
    style?: unknown;
    testID?: string;
    onPress?: () => void;
    [key: string]: unknown;
  };

  const toDomStyle = (style: unknown): React.CSSProperties | undefined => {
    if (!style) {
      return undefined;
    }

    if (Array.isArray(style)) {
      return Object.assign(
        {},
        ...style
          .flat(Number.POSITIVE_INFINITY)
          .map(toDomStyle)
          .filter((s): s is React.CSSProperties => Boolean(s))
      );
    }

    if (typeof style !== 'object') {
      return undefined;
    }

    const domStyle = { ...(style as React.CSSProperties) };
    if (Array.isArray(domStyle.transform)) {
      delete domStyle.transform;
    }
    return domStyle;
  };

  const forwardTestID = (props: ViewLike) => ({
    'data-testid': props.testID,
    style: toDomStyle(props.style),
  });

  return {
    StatusBar: () => null,
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }),
    Alert: { alert: vi.fn() },
    Linking: { openURL: vi.fn() },
    Pressable: ({ children, onPress, ...rest }: ViewLike) =>
      React.createElement(
        'button',
        { type: 'button', onClick: () => onPress?.(), ...forwardTestID(rest) },
        children
      ),
    ScrollView: ({ children, ...rest }: ViewLike) =>
      React.createElement('div', forwardTestID(rest), children),
    StyleSheet: { create: <T,>(s: T) => s },
    Text: ({ children, ...rest }: ViewLike) =>
      React.createElement('span', forwardTestID(rest), children),
    TextInput: ({
      value,
      placeholder,
      onChangeText,
      ...rest
    }: ViewLike & {
      value?: string;
      placeholder?: string;
      onChangeText?: (text: string) => void;
    }) =>
      React.createElement('input', {
        ...forwardTestID(rest),
        placeholder,
        value: value ?? '',
        onChange: (e: { target: { value: string } }) =>
          onChangeText?.(e.target.value),
      }),
    View: ({ children, ...rest }: ViewLike) =>
      React.createElement('div', forwardTestID(rest), children),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Render Ionicons as a host element exposing color via a data attribute so the
// TikTok PlatformCard's iconColor prop can be inspected after render.
vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name, color }: { name: string; color: string }) =>
      React.createElement('i', {
        'data-testid': `icon-${name}`,
        'data-color': color,
      }),

    default: ({ name, color }: { name: string; color: string }) =>
      React.createElement('i', {
        'data-testid': `icon-${name}`,
        'data-color': color,
      }),
    __esModule: true,
  };
});

vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => routeMocks.params,
  useRouter: () => ({ back: routeMocks.back, push: vi.fn() }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      border: '#222',
      card: '#111',
      gold: '#b45309',
      goldLight: '#fef3c7',
      primary: '#3b82f6',
      text: THEME_TEXT,
      textMuted: '#888',
      textOnPrimary: THEME_TEXT_ON_PRIMARY,
      textSecondary: '#aaa',
    },
    shadows: { sm: {} },
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: accessMocks.useMerchant,
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: accessMocks.useRevenueCat,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: readinessMocks.invalidateStoreReadiness,
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => null,
}));

const merchantAnalytics = {
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

vi.mock('@tanstack/react-query', () => ({
  useMutation: mutationMocks.useMutation,
  useQuery: queryMocks.useQuery,
  useQueryClient: () => queryClientMocks,
}));

import AnalyticsConfigScreen from './analytics-config';

describe('AnalyticsConfigScreen — theme token regression (#1636)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.update.mockImplementation(() => ({
      eq: () => ({ error: null }),
    }));
    supabaseMocks.from.mockImplementation(() => ({
      update: supabaseMocks.update,
    }));
    supabaseMocks.rpc.mockImplementation(async () => ({
      data: null,
      error: null,
    }));
    mutationMocks.state.options = null;
    routeMocks.back.mockReset();
    routeMocks.params = {};
    accessMocks.useMerchant.mockReturnValue({
      isLoading: false,
      merchant: { id: 'merchant-1', plan_tier: 'pro', premium_features: [] },
    });
    accessMocks.useRevenueCat.mockReturnValue({ isPro: true });
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });
  });

  it('passes the theme text token to the TikTok PlatformCard icon, not hardcoded black', () => {
    render(<AnalyticsConfigScreen />);

    const tiktokIcon = screen.getByTestId('icon-logo-tiktok');
    expect(tiktokIcon).toHaveAttribute('data-color', THEME_TEXT);
    // Defense-in-depth: explicit assertion against the bug's exact prior value.
    expect(tiktokIcon).not.toHaveAttribute('data-color', '#000000');
  });

  it('passes the textOnPrimary theme token to the offline-conversions toggle knob, not hardcoded white', () => {
    render(<AnalyticsConfigScreen />);

    const knob = screen.getByTestId('offline-conversions-toggle-knob');
    expect(knob).toHaveStyle({ backgroundColor: THEME_TEXT_ON_PRIMARY });
    expect(knob).not.toHaveStyle({ backgroundColor: '#fff' });
    expect(knob).not.toHaveStyle({ backgroundColor: '#ffffff' });
  });

  it('does not expose the shared merchant analytics fixture to component renders', () => {
    render(<AnalyticsConfigScreen />);
    const firstResult = queryMocks.useQuery.mock.results[0]?.value as {
      data: { analytics: typeof merchantAnalytics; isOwner: boolean };
    };
    firstResult.data.analytics.tiktok_pixel_id = 'mutated-in-test';

    expect(firstResult.data.analytics).not.toBe(merchantAnalytics);
    expect(merchantAnalytics.tiktok_pixel_id).toBe('');
  });

  it('does not fetch tracking credentials for RevenueCat-only users before DB entitlement syncs', () => {
    accessMocks.useMerchant.mockReturnValue({
      isLoading: false,
      merchant: { plan_tier: 'free', premium_features: [] },
    });
    accessMocks.useRevenueCat.mockReturnValue({ isPro: true });

    render(<AnalyticsConfigScreen />);

    const options = queryMocks.useQuery.mock.calls.at(-1)?.[0] as {
      enabled?: boolean;
    };
    expect(options.enabled).toBe(false);
    expect(screen.getByText('Pro access is syncing')).toBeInTheDocument();
  });

  it('does not enable the tracking credentials query for locked free merchants', () => {
    accessMocks.useMerchant.mockReturnValue({
      isLoading: false,
      merchant: { plan_tier: 'free', premium_features: [] },
    });
    accessMocks.useRevenueCat.mockReturnValue({ isPro: false });

    render(<AnalyticsConfigScreen />);

    const options = queryMocks.useQuery.mock.calls.at(-1)?.[0] as {
      enabled?: boolean;
    };
    expect(options.enabled).toBe(false);
  });

  it('renders an error state with a working retry action when the credentials query fails', () => {
    // Arrange: the context query fails, so ownership is unknown — the screen
    // must not fall through to the owner gate (which would strip Save from a
    // legitimate owner with no explanation).
    const refetch = vi.fn();
    queryMocks.useQuery.mockReturnValueOnce({
      data: null,
      isError: true,
      isLoading: false,
      refetch,
    });

    // Act
    render(<AnalyticsConfigScreen />);

    // Assert: explicit error state, no editable form, retry wired to refetch.
    expect(
      screen.getByText("Couldn't load analytics settings")
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Meta (Facebook/Instagram)')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry').closest('button') as Element);
    expect(refetch).toHaveBeenCalled();
  });

  it('blocks saving before analytics data has successfully seeded', async () => {
    queryMocks.useQuery.mockReturnValueOnce({
      data: null,
      isError: true,
      isLoading: false,
    });

    render(<AnalyticsConfigScreen />);

    await expect(mutationMocks.state.options?.mutationFn()).rejects.toThrow(
      'Analytics settings are still loading'
    );
    expect(supabaseMocks.update).not.toHaveBeenCalled();
  });
});

describe('AnalyticsConfigScreen — background refetch must not clobber edits (V3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.update.mockImplementation(() => ({
      eq: () => ({ error: null }),
    }));
    supabaseMocks.from.mockImplementation(() => ({
      update: supabaseMocks.update,
    }));
    supabaseMocks.rpc.mockImplementation(async () => ({
      data: null,
      error: null,
    }));
    mutationMocks.state.options = null;
    accessMocks.useMerchant.mockReturnValue({
      isLoading: false,
      merchant: { id: 'merchant-1', plan_tier: 'pro', premium_features: [] },
    });
    accessMocks.useRevenueCat.mockReturnValue({ isPro: true });
  });

  function expandMetaCard() {
    fireEvent.click(
      screen.getByText('Meta (Facebook/Instagram)').closest('button') as Element
    );
  }

  it('keeps a typed edit when a background refetch returns the original value, and saves only the edited field', async () => {
    // Arrange: initial fetch returns the persisted (empty) palette of creds.
    const persisted = { analytics: { ...merchantAnalytics }, isOwner: true };
    queryMocks.useQuery.mockReturnValue({
      data: persisted,
      isError: false,
      isLoading: false,
    });

    const { rerender } = render(<AnalyticsConfigScreen />);
    expandMetaCard();

    // Act: the user types a Facebook Pixel ID into the buffer.
    const pixelInput = screen.getByPlaceholderText('1234567890123456');
    fireEvent.change(pixelInput, { target: { value: 'EDITED-PIXEL-123' } });

    // A background refetch (reconnect / focus) resolves and returns a FRESH
    // object reference carrying the ORIGINAL, still-empty value.
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true }, // new identity, same (empty) data
      isError: false,
      isLoading: false,
    });
    rerender(<AnalyticsConfigScreen />);

    // Assert: the user's typed value survives (one-shot seed did not repaint).
    expect(
      (screen.getByPlaceholderText('1234567890123456') as HTMLInputElement)
        .value
    ).toBe('EDITED-PIXEL-123');

    // Act: save. The per-field dirty diff must write ONLY the edited field.
    await mutationMocks.state.options?.mutationFn();

    expect(supabaseMocks.update).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.update).toHaveBeenCalledWith({
      facebook_pixel_id: 'EDITED-PIXEL-123',
    });
  });

  it('reseeds from fresher analytics data while the form is still clean', () => {
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });

    const { rerender } = render(<AnalyticsConfigScreen />);
    expandMetaCard();
    expect(
      (screen.getByPlaceholderText('1234567890123456') as HTMLInputElement)
        .value
    ).toBe('');

    queryMocks.useQuery.mockReturnValue({
      data: {
        analytics: {
          ...merchantAnalytics,
          facebook_pixel_id: 'FRESH-PIXEL-456',
        },
        isOwner: true,
      },
      isError: false,
      isLoading: false,
    });
    rerender(<AnalyticsConfigScreen />);

    expect(
      (screen.getByPlaceholderText('1234567890123456') as HTMLInputElement)
        .value
    ).toBe('FRESH-PIXEL-456');
  });

  it('skips the write entirely when nothing changed (no-op save)', async () => {
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });

    render(<AnalyticsConfigScreen />);
    await mutationMocks.state.options?.mutationFn();

    expect(supabaseMocks.update).not.toHaveBeenCalled();
  });

  it('keeps reconnect and focus refetching enabled while the query is errored and unseeded', () => {
    // Initial query errors: no data, so the buffer never seeds. The error
    // state replaces the form, and background recovery must stay enabled so a
    // reconnect refetch (or the Retry button) can seed the snapshot.
    queryMocks.useQuery.mockReturnValue({
      data: null,
      isError: true,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<AnalyticsConfigScreen />);

    const options = queryMocks.useQuery.mock.calls.at(-1)?.[0] as {
      refetchOnWindowFocus?: boolean;
      refetchOnReconnect?: boolean;
    };
    expect(options.refetchOnWindowFocus).toBe(true);
    expect(options.refetchOnReconnect).toBe(true);
  });

  it('keeps reconnect and focus refetching enabled until the form becomes dirty', () => {
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });

    const { rerender } = render(<AnalyticsConfigScreen />);

    let options = queryMocks.useQuery.mock.calls.at(-1)?.[0] as {
      refetchOnWindowFocus?: boolean;
      refetchOnReconnect?: boolean;
    };
    expect(options.refetchOnWindowFocus).toBe(true);
    expect(options.refetchOnReconnect).toBe(true);

    fireEvent.click(
      screen.getByText('Meta (Facebook/Instagram)').closest('button') as Element
    );
    fireEvent.change(screen.getByPlaceholderText('1234567890123456'), {
      target: { value: 'EDITED-PIXEL-123' },
    });
    rerender(<AnalyticsConfigScreen />);

    options = queryMocks.useQuery.mock.calls.at(-1)?.[0] as {
      refetchOnWindowFocus?: boolean;
      refetchOnReconnect?: boolean;
    };
    expect(options.refetchOnWindowFocus).toBe(false);
    expect(options.refetchOnReconnect).toBe(false);
  });

  it('marks the saved buffer clean so refetching resumes and repeated saves do not rewrite the same fields', async () => {
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });

    const { rerender } = render(<AnalyticsConfigScreen />);

    expandMetaCard();
    fireEvent.change(screen.getByPlaceholderText('1234567890123456'), {
      target: { value: 'EDITED-PIXEL-123' },
    });
    rerender(<AnalyticsConfigScreen />);

    let options = queryMocks.useQuery.mock.calls.at(-1)?.[0] as {
      refetchOnWindowFocus?: boolean;
      refetchOnReconnect?: boolean;
    };
    expect(options.refetchOnWindowFocus).toBe(false);
    expect(options.refetchOnReconnect).toBe(false);

    await mutationMocks.state.options?.mutationFn();
    expect(supabaseMocks.update).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.update).toHaveBeenLastCalledWith({
      facebook_pixel_id: 'EDITED-PIXEL-123',
    });

    await act(async () => {
      mutationMocks.state.options?.onSuccess?.();
      await Promise.resolve();
    });
    expect(queryClientMocks.setQueryData).toHaveBeenCalledWith(
      ['merchant-analytics-full', 'user-1', 'merchant-1'],
      expect.objectContaining({
        analytics: expect.objectContaining({
          facebook_pixel_id: 'EDITED-PIXEL-123',
        }),
        isOwner: true,
      })
    );
    queryMocks.useQuery.mockReturnValue({
      data: {
        analytics: {
          ...merchantAnalytics,
          facebook_pixel_id: 'EDITED-PIXEL-123',
        },
        isOwner: true,
      },
      isError: false,
      isLoading: false,
    });
    rerender(<AnalyticsConfigScreen />);

    options = queryMocks.useQuery.mock.calls.at(-1)?.[0] as {
      refetchOnWindowFocus?: boolean;
      refetchOnReconnect?: boolean;
    };
    expect(options.refetchOnWindowFocus).toBe(true);
    expect(options.refetchOnReconnect).toBe(true);

    await mutationMocks.state.options?.mutationFn();
    expect(supabaseMocks.update).toHaveBeenCalledTimes(1);
  });

  it('keeps edits made while a save is pending dirty after the save succeeds', async () => {
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });

    const { rerender } = render(<AnalyticsConfigScreen />);

    expandMetaCard();
    const pixelInput = screen.getByPlaceholderText('1234567890123456');
    fireEvent.change(pixelInput, {
      target: { value: 'SAVED-PIXEL-123' },
    });

    const savedAnalytics = await mutationMocks.state.options?.mutationFn();
    expect(supabaseMocks.update).toHaveBeenCalledWith({
      facebook_pixel_id: 'SAVED-PIXEL-123',
    });

    fireEvent.change(pixelInput, {
      target: { value: 'PENDING-PIXEL-456' },
    });

    await act(async () => {
      mutationMocks.state.options?.onSuccess?.(savedAnalytics);
      await Promise.resolve();
    });
    rerender(<AnalyticsConfigScreen />);

    expect(
      (screen.getByPlaceholderText('1234567890123456') as HTMLInputElement)
        .value
    ).toBe('PENDING-PIXEL-456');

    const options = queryMocks.useQuery.mock.calls.at(-1)?.[0] as {
      refetchOnWindowFocus?: boolean;
      refetchOnReconnect?: boolean;
    };
    expect(options.refetchOnWindowFocus).toBe(false);
    expect(options.refetchOnReconnect).toBe(false);

    await mutationMocks.state.options?.mutationFn();
    expect(supabaseMocks.update).toHaveBeenLastCalledWith({
      facebook_pixel_id: 'PENDING-PIXEL-456',
    });
  });

  it('snapshots the saved analytics and reports success after a save so the post-save buffer is clean', async () => {
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });

    const { rerender } = render(<AnalyticsConfigScreen />);

    expandMetaCard();
    fireEvent.change(screen.getByPlaceholderText('1234567890123456'), {
      target: { value: 'EDITED-PIXEL-123' },
    });
    rerender(<AnalyticsConfigScreen />);

    await mutationMocks.state.options?.mutationFn();
    expect(supabaseMocks.update).toHaveBeenCalledTimes(1);

    await act(async () => {
      mutationMocks.state.options?.onSuccess?.();
      await Promise.resolve();
    });

    // The success alert is surfaced and the saved buffer becomes the new
    // snapshot, so a repeat save with no further edits issues no update.
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Analytics settings saved!',
      expect.any(Array)
    );
    expect(queryClientMocks.setQueryData).toHaveBeenCalledWith(
      ['merchant-analytics-full', 'user-1', 'merchant-1'],
      expect.objectContaining({
        analytics: expect.objectContaining({
          facebook_pixel_id: 'EDITED-PIXEL-123',
        }),
        isOwner: true,
      })
    );

    await mutationMocks.state.options?.mutationFn();
    expect(supabaseMocks.update).toHaveBeenCalledTimes(1);
  });

  it('waits for readiness invalidation before showing analytics save success', async () => {
    let releaseReadiness!: () => void;
    const readiness = new Promise<void>((resolve) => {
      releaseReadiness = resolve;
    });
    readinessMocks.invalidateStoreReadiness.mockReturnValueOnce(readiness);
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });
    render(<AnalyticsConfigScreen />);

    const completion = mutationMocks.state.options?.onSuccess?.({
      ...merchantAnalytics,
    });
    await Promise.resolve();
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Success',
      'Analytics settings saved!',
      expect.any(Array)
    );

    releaseReadiness();
    await completion;
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Analytics settings saved!',
      expect.any(Array)
    );
  });

  it('reports analytics save success when the post-save readiness refresh rejects', async () => {
    // Regression: the settings write has already persisted, so a best-effort
    // readiness refresh must not turn that successful save into an error.
    readinessMocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('readiness unavailable')
    );
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });
    render(<AnalyticsConfigScreen />);

    await act(async () => {
      await expect(
        mutationMocks.state.options?.onSuccess?.({ ...merchantAnalytics })
      ).resolves.toBeUndefined();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Analytics settings saved!',
      expect.any(Array)
    );
  });

  it('returns to the checklist without a success alert after a checklist analytics save', async () => {
    routeMocks.params = { from: 'setup' };
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });
    render(<AnalyticsConfigScreen />);

    await act(async () => {
      await mutationMocks.state.options?.onSuccess?.({
        ...merchantAnalytics,
      });
    });

    expect(routeMocks.back).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Success',
      expect.any(String),
      expect.any(Array)
    );
  });

  it('does not update analytics cache or navigate after the merchant switches during readiness refresh', async () => {
    let releaseReadiness!: () => void;
    const readiness = new Promise<void>((resolve) => {
      releaseReadiness = resolve;
    });
    readinessMocks.invalidateStoreReadiness.mockReturnValueOnce(readiness);
    routeMocks.params = { from: 'setup' };
    render(<AnalyticsConfigScreen />);
    const originOptions = mutationMocks.state.options;
    const saveContext = await originOptions?.onMutate?.();

    accessMocks.useMerchant.mockReturnValue({
      isLoading: false,
      merchant: { id: 'merchant-2', plan_tier: 'pro', premium_features: [] },
    });
    render(<AnalyticsConfigScreen />);

    const completion = mutationMocks.state.options?.onSuccess?.(
      { ...merchantAnalytics },
      undefined,
      saveContext
    );
    await Promise.resolve();
    releaseReadiness();
    await completion;

    expect(queryClientMocks.setQueryData).not.toHaveBeenCalled();
    expect(routeMocks.back).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('bugfix: tracking credentials load via get_user_merchant_context (revoked-column 42501)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.update.mockImplementation(() => ({
      eq: () => ({ error: null }),
    }));
    supabaseMocks.from.mockImplementation(() => ({
      update: supabaseMocks.update,
    }));
    supabaseMocks.rpc.mockImplementation(async () => ({
      data: null,
      error: null,
    }));
    mutationMocks.state.options = null;
    accessMocks.useMerchant.mockReturnValue({
      isLoading: false,
      merchant: { id: 'merchant-1', plan_tier: 'pro', premium_features: [] },
    });
    accessMocks.useRevenueCat.mockReturnValue({ isPro: true });
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: true },
      isError: false,
      isLoading: false,
    });
  });

  function captureQueryFn() {
    const options = queryMocks.useQuery.mock.calls.at(-1)?.[0] as {
      queryFn: () => Promise<unknown>;
    };
    return options.queryFn;
  }

  it('fetches credentials through the SECURITY DEFINER RPC, never selecting merchants columns directly', async () => {
    // Arrange: the RPC returns the merchant context payload with a token that
    // a direct authenticated table read would 42501 on.
    supabaseMocks.rpc.mockImplementation(async () => ({
      data: {
        merchant: { ...merchantAnalytics, ga4_api_secret: 'owner-secret' },
        staffAccess: { isOwner: true, isStaff: false },
      },
      error: null,
    }));
    render(<AnalyticsConfigScreen />);

    // Act: run the real query function the screen registered.
    const result = await captureQueryFn()();

    // Assert: the read went through the RPC and no direct merchants select ran.
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_user_merchant_context');
    expect(supabaseMocks.from).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      analytics: { ga4_api_secret: 'owner-secret' },
      isOwner: true,
    });
  });

  it('shows the owner-only notice instead of the editable form for staff', () => {
    // Arrange: a staff session — the RPC redacts tokens and isOwner is false.
    queryMocks.useQuery.mockReturnValue({
      data: {
        analytics: { ...merchantAnalytics, ga4_api_secret: null },
        isOwner: false,
      },
      isError: false,
      isLoading: false,
    });

    // Act
    render(<AnalyticsConfigScreen />);

    // Assert: notice shown, editable platform sections absent.
    expect(screen.getByText('Owner-only settings')).toBeInTheDocument();
    expect(
      screen.queryByText('Meta (Facebook/Instagram)')
    ).not.toBeInTheDocument();
  });

  it('rejects a staff save attempt without writing or reporting success', async () => {
    // Arrange
    queryMocks.useQuery.mockReturnValue({
      data: { analytics: { ...merchantAnalytics }, isOwner: false },
      isError: false,
      isLoading: false,
    });
    render(<AnalyticsConfigScreen />);

    // Act + Assert: the mutation is owner-gated and nothing is written.
    await expect(mutationMocks.state.options?.mutationFn()).rejects.toThrow(
      'Only the store owner can manage analytics credentials.'
    );
    expect(supabaseMocks.update).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalledWith('Success', expect.anything());
  });

  it('throws when the RPC reports an error', async () => {
    supabaseMocks.rpc.mockImplementation(async () => ({
      data: null,
      error: new Error('rpc unavailable'),
    }));
    render(<AnalyticsConfigScreen />);

    await expect(captureQueryFn()()).rejects.toThrow('rpc unavailable');
  });

  it('throws a merchant-not-found error when the RPC returns no context', async () => {
    supabaseMocks.rpc.mockImplementation(async () => ({
      data: null,
      error: null,
    }));
    render(<AnalyticsConfigScreen />);

    await expect(captureQueryFn()()).rejects.toThrow(
      'Merchant profile not found'
    );
  });
});
