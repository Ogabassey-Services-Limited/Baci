import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SPACING } from '@/constants/theme';
import Paywall from './Paywall';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  capturedCloseTop: 0,
  capturedHeaderPaddingTop: 0,
  capturedStickyPaddingBottom: 0,
  insets: { bottom: 34, left: 0, right: 0, top: 44 },
  isMerchantLoading: false,
  isPro: false,
  merchant: {
    id: 'merchant-1',
    plan_expires_at: null as string | null,
    plan_tier: 'free' as string | null,
    premium_features: [] as string[],
  } as {
    id: string;
    plan_expires_at: string | null;
    plan_tier: string | null;
    premium_features: string[];
  } | null,
  openNativeManagement: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  hasFullProAccess: vi.fn(),
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
    isPro: mocks.isPro,
    purchasePackage: mocks.purchasePackage,
    restorePurchases: mocks.restorePurchases,
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    isLoading: mocks.isMerchantLoading,
    merchant: mocks.merchant,
  }),
}));

vi.mock('@/lib/feature-gates', () => ({
  baciFeatureGates: {
    hasFullProAccess: (...args: unknown[]) => mocks.hasFullProAccess(...args),
  },
}));

vi.mock('@/utils/SubscriptionManagement', () => ({
  SubscriptionManagement: {
    openNativeManagement: () => mocks.openNativeManagement(),
  },
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

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name?: string }) => <span>{name}</span>,

  default: ({ name }: { name?: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  StatusBar: () => null,
  ActivityIndicator: () => <span aria-label="loading" role="progressbar" />,
  Alert: { alert: mocks.alert },
  Dimensions: { get: () => ({ width: 390 }) },
  Linking: { openURL: vi.fn() },
  Platform: { OS: 'ios' },
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
    style,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    style?: unknown;
  }) => {
    const resolvedStyle =
      typeof style === 'function' ? style({ pressed: false }) : style;
    const entries = (
      Array.isArray(resolvedStyle) ? resolvedStyle : [resolvedStyle]
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
        aria-label={accessibilityLabel}
        disabled={disabled}
        onClick={() => onPress?.()}
        type="button"
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
  beforeEach(() => {
    mocks.alert.mockReset();
    mocks.capturedCloseTop = 0;
    mocks.capturedHeaderPaddingTop = 0;
    mocks.capturedStickyPaddingBottom = 0;
    mocks.hasFullProAccess.mockReset();
    mocks.hasFullProAccess.mockReturnValue(false);
    mocks.insets = { bottom: 34, left: 0, right: 0, top: 44 };
    mocks.isMerchantLoading = false;
    mocks.isPro = false;
    mocks.merchant = {
      id: 'merchant-1',
      plan_expires_at: null,
      plan_tier: 'free',
      premium_features: [],
    };
    mocks.openNativeManagement.mockReset();
    mocks.purchasePackage.mockReset();
    mocks.restorePurchases.mockReset();
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

  it('does not show fallback purchase success when purchase returns an error result', async () => {
    mocks.purchasePackage.mockResolvedValue({
      error: 'Purchase failed',
      status: 'error',
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

  it('does not show success feedback when purchase is cancelled', async () => {
    mocks.purchasePackage.mockResolvedValue({ status: 'cancelled' });

    render(<Paywall />);

    const purchaseButton = screen.getByRole('button', {
      name: /Subscribe to Monthly for \$9\.99/i,
    });
    fireEvent.click(purchaseButton);

    await waitFor(() => {
      expect(mocks.purchasePackage).toHaveBeenCalledTimes(1);
    });
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it('shows fallback purchase success when purchase succeeds without immediate pro access', async () => {
    mocks.purchasePackage.mockResolvedValue({
      isPro: false,
      status: 'success',
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

  it('shows pro success and closes paywall when purchase succeeds with pro access', async () => {
    const onClose = vi.fn();
    mocks.purchasePackage.mockResolvedValue({ isPro: true, status: 'success' });

    render(<Paywall onClose={onClose} />);

    const purchaseButton = screen.getByRole('button', {
      name: /Subscribe to Monthly for \$9\.99/i,
    });
    fireEvent.click(purchaseButton);

    await waitFor(() => {
      expect(mocks.purchasePackage).toHaveBeenCalledTimes(1);
    });
    expect(mocks.alert).toHaveBeenCalledWith(
      'Success',
      'You are now a Pro member!',
      [{ text: 'OK', onPress: onClose }]
    );
  });

  it('uses the manage state for server-backed Pro entitlements', () => {
    mocks.hasFullProAccess.mockReturnValue(true);
    mocks.isPro = false;
    mocks.merchant = {
      id: 'merchant-1',
      plan_expires_at: null,
      plan_tier: 'pro',
      premium_features: [],
    };

    render(<Paywall />);

    expect(
      screen.getByRole('button', { name: /manage your subscription/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /subscribe to monthly/i })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /manage your subscription/i })
    );

    expect(mocks.alert).toHaveBeenCalledWith(
      'Baci Pro is active',
      expect.stringContaining('managed through your Baci account')
    );
    expect(mocks.openNativeManagement).not.toHaveBeenCalled();
    expect(mocks.purchasePackage).not.toHaveBeenCalled();
  });

  it('opens native subscription management for RevenueCat Pro entitlements', () => {
    mocks.hasFullProAccess.mockReturnValue(false);
    mocks.isPro = true;

    render(<Paywall />);

    fireEvent.click(
      screen.getByRole('button', { name: /manage your subscription/i })
    );

    expect(mocks.openNativeManagement).toHaveBeenCalledTimes(1);
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Baci Pro is active',
      expect.any(String)
    );
  });

  it('uses native subscription management when RevenueCat and server Pro are both active', () => {
    mocks.hasFullProAccess.mockReturnValue(true);
    mocks.isPro = true;
    mocks.merchant = {
      id: 'merchant-1',
      plan_expires_at: null,
      plan_tier: 'pro',
      premium_features: [],
    };

    render(<Paywall />);

    fireEvent.click(
      screen.getByRole('button', { name: /manage your subscription/i })
    );

    expect(mocks.openNativeManagement).toHaveBeenCalledTimes(1);
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Baci Pro is active',
      expect.any(String)
    );
  });

  it('shows an error alert when native subscription management fails', async () => {
    mocks.isPro = true;
    mocks.openNativeManagement.mockRejectedValue(
      new Error('Subscription settings unavailable')
    );

    render(<Paywall />);

    fireEvent.click(
      screen.getByRole('button', { name: /manage your subscription/i })
    );

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Error',
        'Unable to open subscription management'
      );
    });
  });

  it('disables purchase while merchant entitlements are loading', () => {
    mocks.isMerchantLoading = true;
    mocks.isPro = false;
    mocks.merchant = null;

    render(<Paywall />);

    const purchaseButton = screen.getByRole('button', {
      name: /loading subscription status/i,
    });

    expect(purchaseButton).toBeDisabled();
    fireEvent.click(purchaseButton);

    expect(mocks.purchasePackage).not.toHaveBeenCalled();
    expect(mocks.openNativeManagement).not.toHaveBeenCalled();
  });

  it('keeps the purchase CTA for product-limit-only grants', () => {
    mocks.hasFullProAccess.mockReturnValue(false);
    mocks.isPro = false;
    mocks.merchant = {
      id: 'merchant-1',
      plan_expires_at: null,
      plan_tier: 'free',
      premium_features: ['product_limit'],
    };

    render(<Paywall />);

    expect(
      screen.getByRole('button', { name: /subscribe to monthly/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /manage your subscription/i })
    ).not.toBeInTheDocument();
  });
});
