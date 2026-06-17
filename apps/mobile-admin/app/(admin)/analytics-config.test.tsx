import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
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

// Captures the Supabase `.update()` payload so tests can assert exactly which
// analytics fields were written (drift vector V3: a save must not rewrite
// unchanged fields, and a background refetch must not clobber typed edits).
const supabaseMocks = vi.hoisted(() => ({
  update: vi.fn(() => ({ eq: () => ({ error: null }) })),
  selectSingle: vi.fn(async () => ({ data: null, error: null })),
}));

// Drives the real mutationFn: useMutation captures the options and `mutate`
// invokes the mutationFn so the per-field dirty diff actually runs.
const mutationMocks = vi.hoisted(() => {
  type MutationOptions = { mutationFn: () => Promise<unknown> };
  const state: { options: MutationOptions | null } = { options: null };
  return {
    state,
    useMutation: (options: MutationOptions) => {
      state.options = options;
      return {
        isPending: false,
        mutate: () => {
          void options.mutationFn();
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
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      border: '#222',
      card: '#111',
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

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: supabaseMocks.selectSingle }),
      }),
      update: supabaseMocks.update,
    }),
  },
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
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import AnalyticsConfigScreen from './analytics-config';
import {
  type AnalyticsState,
  buildAnalyticsDiff,
} from './analytics-config-diff';

const seededState: AnalyticsState = {
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

describe('AnalyticsConfigScreen — theme token regression (#1636)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.update.mockImplementation(() => ({
      eq: () => ({ error: null }),
    }));
    supabaseMocks.selectSingle.mockImplementation(async () => ({
      data: null,
      error: null,
    }));
    mutationMocks.state.options = null;
    queryMocks.useQuery.mockReturnValue({
      data: { ...merchantAnalytics },
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
      data: typeof merchantAnalytics;
    };
    firstResult.data.tiktok_pixel_id = 'mutated-in-test';

    expect(firstResult.data).not.toBe(merchantAnalytics);
    expect(merchantAnalytics.tiktok_pixel_id).toBe('');
  });

  it('falls back to default unconfigured state when analytics data is missing after a query error', () => {
    queryMocks.useQuery.mockReturnValueOnce({
      data: null,
      isError: true,
      isLoading: false,
    });

    render(<AnalyticsConfigScreen />);

    expect(screen.getByTestId('icon-logo-tiktok')).toHaveAttribute(
      'data-color',
      THEME_TEXT
    );
    expect(screen.getByTestId('offline-conversions-toggle-knob')).toHaveStyle({
      backgroundColor: THEME_TEXT_ON_PRIMARY,
    });
    expect(screen.getAllByText('Not configured')).toHaveLength(4);
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
    supabaseMocks.selectSingle.mockImplementation(async () => ({
      data: null,
      error: null,
    }));
    mutationMocks.state.options = null;
  });

  function expandMetaCard() {
    fireEvent.click(
      screen.getByText('Meta (Facebook/Instagram)').closest('button') as Element
    );
  }

  it('keeps a typed edit when a background refetch returns the original value, and saves only the edited field', async () => {
    // Arrange: initial fetch returns the persisted (empty) palette of creds.
    const persisted = { ...merchantAnalytics };
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
      data: { ...merchantAnalytics }, // new identity, same (empty) data
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
      data: { ...merchantAnalytics },
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
      data: { ...merchantAnalytics, facebook_pixel_id: 'FRESH-PIXEL-456' },
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
      data: { ...merchantAnalytics },
      isError: false,
      isLoading: false,
    });

    render(<AnalyticsConfigScreen />);
    await mutationMocks.state.options?.mutationFn();

    expect(supabaseMocks.update).not.toHaveBeenCalled();
  });

  it('keeps reconnect and focus refetching enabled until the form becomes dirty', () => {
    queryMocks.useQuery.mockReturnValue({
      data: { ...merchantAnalytics },
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
});

describe('buildAnalyticsDiff', () => {
  it('returns only the fields that changed versus the seeded baseline', () => {
    const current: AnalyticsState = {
      ...seededState,
      facebook_pixel_id: 'fb-123',
      offline_conversions_enabled: false,
    };

    expect(buildAnalyticsDiff(current, seededState)).toEqual({
      facebook_pixel_id: 'fb-123',
      offline_conversions_enabled: false,
    });
  });

  it('returns an empty diff when nothing changed', () => {
    expect(buildAnalyticsDiff({ ...seededState }, seededState)).toEqual({});
  });

  it('persists a cleared string field as null, not empty string', () => {
    const baseline: AnalyticsState = {
      ...seededState,
      ga4_api_secret: 'secret',
    };
    const current: AnalyticsState = { ...baseline, ga4_api_secret: '' };

    expect(buildAnalyticsDiff(current, baseline)).toEqual({
      ga4_api_secret: null,
    });
  });

  it('writes every field when there is no baseline snapshot', () => {
    const current: AnalyticsState = {
      ...seededState,
      tiktok_pixel_id: 'tt-1',
    };
    const diff = buildAnalyticsDiff(current, null);

    expect(diff.tiktok_pixel_id).toBe('tt-1');
    expect(diff.facebook_pixel_id).toBeNull();
    expect(diff.offline_conversions_enabled).toBe(true);
  });
});
