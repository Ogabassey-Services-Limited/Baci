import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
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
    TextInput: ({ ...rest }: ViewLike) =>
      React.createElement('input', forwardTestID(rest)),
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
vi.mock('@react-native-vector-icons/ionicons/static', async () => {
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
        eq: () => ({ single: async () => ({ data: null, error: null }) }),
      }),
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
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQuery: queryMocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import AnalyticsConfigScreen from './analytics-config';

describe('AnalyticsConfigScreen — theme token regression (#1636)', () => {
  beforeEach(() => {
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
});
