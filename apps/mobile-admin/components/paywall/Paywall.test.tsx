import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPACING } from '@/constants/theme';
import Paywall from './Paywall';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  capturedCloseTop: 0,
  capturedHeaderPaddingTop: 0,
  capturedStickyPaddingBottom: 0,
  insets: { bottom: 34, left: 0, right: 0, top: 44 },
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  storeError: null as string | null,
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
    purchasePackage: mocks.purchasePackage,
    restorePurchases: mocks.restorePurchases,
  }),
}));

vi.mock('@/stores/revenueCatStore', () => {
  const useRevenueCatStore = Object.assign(() => ({}), {
    getState: () => ({ error: mocks.storeError }),
  });

  return { useRevenueCatStore };
});

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
  Alert: { alert: mocks.alert },
  Dimensions: { get: () => ({ width: 390 }) },
  Linking: { openURL: vi.fn() },
  Platform: { OS: 'ios' },
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
    style,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
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
    return (
      <button
        type="button"
        aria-label={accessibilityLabel}
        onClick={() => onPress?.()}
      >
        {children}
      </button>
    );
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
    mocks.alert.mockReset();
    mocks.capturedCloseTop = 0;
    mocks.capturedHeaderPaddingTop = 0;
    mocks.capturedStickyPaddingBottom = 0;
    mocks.purchasePackage.mockReset();
    mocks.restorePurchases.mockReset();
    mocks.storeError = null;
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

  it('scales spacing based on larger safe-area insets', () => {
    mocks.insets = { bottom: 21, left: 0, right: 0, top: 59 };
    render(<Paywall />);

    expect(mocks.capturedHeaderPaddingTop).toBe(85);
    expect(mocks.capturedCloseTop).toBe(70);
    expect(mocks.capturedStickyPaddingBottom).toBe(27);
  });

  it('does not show fallback purchase success when store error is updated during purchase', async () => {
    mocks.purchasePackage.mockImplementation(async () => {
      mocks.storeError = 'Purchase failed';
      return false;
    });

    render(<Paywall />);

    const purchaseButton = screen.getByRole('button', {
      name: /Subscribe to Monthly for \$9\.99/i,
    });
    fireEvent.click(purchaseButton);

    await waitFor(() => {
      expect(mocks.purchasePackage).toHaveBeenCalledTimes(1);
    });
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Purchase Complete',
      expect.any(String),
      expect.any(Array)
    );
  });

  it('shows fallback purchase success when purchase is non-pro and no store error exists', async () => {
    mocks.purchasePackage.mockImplementation(async () => {
      mocks.storeError = null;
      return false;
    });

    render(<Paywall />);

    const purchaseButton = screen.getByRole('button', {
      name: /Subscribe to Monthly for \$9\.99/i,
    });
    fireEvent.click(purchaseButton);

    await waitFor(() => {
      expect(mocks.purchasePackage).toHaveBeenCalledTimes(1);
    });
    expect(mocks.alert).toHaveBeenCalledWith(
      'Purchase Complete',
      expect.any(String),
      expect.any(Array)
    );
  });
});
