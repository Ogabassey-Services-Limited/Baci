import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Sentinel hex values so the test catches accidental reintroduction of the
// hardcoded #000000 / #fff this PR fixes. If the source goes back to
// hardcoded colors, the rendered DOM won't carry these sentinels and the
// assertions fail.
const THEME_TEXT = '#abcdef';
const THEME_TEXT_ON_PRIMARY = '#fedcba';

vi.mock('react-native', async () => {
  const React = await import('react');

  type ViewLike = {
    children?: React.ReactNode;
    style?: unknown;
    testID?: string;
    onPress?: () => void;
    [key: string]: unknown;
  };

  // RN style props can be a single object, an array, or nested arrays of
  // (object | undefined | false). React DOM expects a flat object on the
  // `style` attribute — passing an array would let React DOM hit a frozen
  // proxy on its synthetic style accessor with `'set' on proxy: trap
  // returned falsish for property '0'`. Flatten + filter falsy entries
  // before forwarding so the assertions below see a real CSSProperties.
  const flattenStyle = (style: unknown): React.CSSProperties | undefined => {
    if (!style) return undefined;
    if (Array.isArray(style)) {
      return Object.assign(
        {},
        ...style
          .flat(Number.POSITIVE_INFINITY)
          .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      ) as React.CSSProperties;
    }
    return style as React.CSSProperties;
  };

  const forwardTestID = (props: ViewLike) => ({
    'data-testid': props.testID,
    style: flattenStyle(props.style),
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
vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name, color }: { name: string; color: string }) =>
      React.createElement('i', {
        'data-testid': `icon-${name}`,
        'data-color': color,
      }),
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

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQuery: () => ({
    data: {
      facebook_capi_token: '',
      facebook_pixel_id: '',
      ga4_api_secret: '',
      google_analytics_id: '',
      offline_conversions_enabled: true,
      snapchat_capi_token: '',
      snapchat_pixel_id: '',
      tiktok_access_token: '',
      tiktok_pixel_id: '',
    },
    isLoading: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import AnalyticsConfigScreen from './analytics-config';

describe('AnalyticsConfigScreen — theme token regression (#1636)', () => {
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
    const styleAttr = knob.getAttribute('style') ?? '';
    expect(styleAttr).toContain(`background-color: ${THEME_TEXT_ON_PRIMARY}`);
    expect(styleAttr).not.toContain('#fff');
    expect(styleAttr).not.toContain('#ffffff');
  });
});
