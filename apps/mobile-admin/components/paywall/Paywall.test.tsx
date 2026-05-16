import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPACING } from '@/constants/theme';
import Paywall from './Paywall';

const mocks = vi.hoisted(() => ({
  capturedCloseTop: 0,
  capturedHeaderPaddingTop: 0,
  capturedStickyPaddingBottom: 0,
  insets: { bottom: 34, left: 0, right: 0, top: 44 },
  offering: {
    availablePackages: [
      {
        identifier: 'monthly',
        packageType: 'MONTHLY',
        product: {
          priceString: '$9.99',
          title: 'Monthly',
        },
      },
    ],
  },
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      primary: '#2563eb',
      success: '#16a34a',
      text: '#0f172a',
      textMuted: '#64748b',
      textSecondary: '#334155',
    },
    shadows: {},
  }),
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({
    currentOffering: mocks.offering,
    error: null,
    isLoading: false,
    isPro: false,
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mocks.insets,
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({
    children,
    style,
  }: {
    children?: ReactNode;
    style?: unknown;
  }) => {
    const entries = (Array.isArray(style) ? style : [style]).filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object'
    );
    const mergedStyle = Object.assign({}, ...entries);
    if (
      'borderBottomLeftRadius' in mergedStyle &&
      'borderBottomRightRadius' in mergedStyle &&
      'paddingTop' in mergedStyle
    ) {
      mocks.capturedHeaderPaddingTop = Number(
        (mergedStyle as { paddingTop?: number }).paddingTop ?? 0
      );
    }

    return <div>{children}</div>;
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: { alert: vi.fn() },
  Dimensions: { get: () => ({ width: 390 }) },
  Linking: { openURL: vi.fn() },
  Pressable: ({
    children,
    style,
  }: {
    children?: ReactNode;
    style?: unknown;
  }) => {
    const resolvedStyle =
      typeof style === 'function' ? style({ pressed: false }) : style;
    const entries = (Array.isArray(resolvedStyle)
      ? resolvedStyle
      : [resolvedStyle]
    ).filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object'
    );
    const mergedStyle = Object.assign({}, ...entries);
    if (
      (mergedStyle as { position?: string }).position === 'absolute' &&
      (mergedStyle as { width?: number }).width === 32 &&
      (mergedStyle as { right?: number }).right === 20
    ) {
      mocks.capturedCloseTop = Number(
        (mergedStyle as { top?: number }).top ?? 0
      );
    }
    return <button type="button">{children}</button>;
  },
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children, style }: { children?: ReactNode; style?: unknown }) => {
    const entries = (Array.isArray(style) ? style : [style]).filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object'
    );
    const mergedStyle = Object.assign({}, ...entries);
    if (
      (mergedStyle as { position?: string }).position === 'absolute' &&
      (mergedStyle as { borderTopWidth?: number }).borderTopWidth === 1
    ) {
      mocks.capturedStickyPaddingBottom = Number(
        (mergedStyle as { paddingBottom?: number }).paddingBottom ?? 0
      );
    }
    return <div>{children}</div>;
  },
}));

describe('Paywall', () => {
  afterEach(() => {
    mocks.capturedCloseTop = 0;
    mocks.capturedHeaderPaddingTop = 0;
    mocks.capturedStickyPaddingBottom = 0;
  });

  it('uses inset-driven top and footer spacing when safe-area insets are present', () => {
    mocks.insets = { bottom: 34, left: 0, right: 0, top: 44 };
    render(<Paywall />);

    expect(mocks.capturedHeaderPaddingTop).toBe(70);
    expect(mocks.capturedCloseTop).toBe(55);
    expect(mocks.capturedStickyPaddingBottom).toBe(40);
  });

  it('falls back to compact spacing when no safe-area insets are present', () => {
    mocks.insets = { bottom: 0, left: 0, right: 0, top: 0 };
    render(<Paywall />);

    expect(mocks.capturedHeaderPaddingTop).toBe(50);
    expect(mocks.capturedCloseTop).toBe(30);
    expect(mocks.capturedStickyPaddingBottom).toBe(SPACING.xl);
  });
});
