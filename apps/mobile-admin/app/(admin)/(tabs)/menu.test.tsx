import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MenuScreen from './menu';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  hasFeature: vi.fn(),
  isPro: true,
  resetOnboarding: vi.fn(),
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  signOut: vi.fn(),
  unregisterPush: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StatusBar: () => null,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock('@/components/settings/SubscriptionStatusCard', () => ({
  SubscriptionStatusCard: ({ onPress }: { onPress?: () => void }) => (
    <button onClick={() => onPress?.()} type="button">
      Subscription status
    </button>
  ),
}));

vi.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    resetOnboarding: mocks.resetOnboarding,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: mocks.signOut,
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: { id: 'merchant-1', premium_features: [] },
  }),
}));

vi.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    unregisterPush: mocks.unregisterPush,
  }),
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({
    customerInfo: null,
    isPro: mocks.isPro,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#ffffff',
      cardHover: '#f8fafc',
      error: '#dc2626',
      gold: '#b45309',
      goldLight: '#fef3c7',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#64748b',
      textSecondary: '#475569',
    },
    isDark: false,
    shadows: { sm: {} },
  }),
}));

vi.mock('@/lib/feature-gates', () => ({
  baciFeatureGates: {
    hasFeature: (...args: unknown[]) => mocks.hasFeature(...args),
  },
}));

describe('MenuScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('__DEV__', false);
    mocks.hasFeature.mockReturnValue(true);
    mocks.isPro = true;
  });

  it('renders the main menu sections', () => {
    render(<MenuScreen />);

    expect(screen.getByText('Menu')).toBeTruthy();
    expect(screen.getByText('Store')).toBeTruthy();
    expect(screen.getByText('Business')).toBeTruthy();
    expect(screen.getByText('Support')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
  });

  it('routes accessible feature rows directly', () => {
    render(<MenuScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: /Domains\. Custom domain settings/i })
    );

    expect(mocks.router.push).toHaveBeenCalledWith('/domains');
  });

  it('routes feature rows when RevenueCat reports Pro', () => {
    mocks.hasFeature.mockReturnValue(false);

    render(<MenuScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: /Domains\. Custom domain settings/i })
    );

    expect(mocks.router.push).toHaveBeenCalledWith('/domains');
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it('does not route locked feature rows without DB or RevenueCat access', () => {
    mocks.hasFeature.mockReturnValue(false);
    mocks.isPro = false;

    render(<MenuScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: /Domains\. Custom domain settings/i })
    );

    expect(mocks.router.push).not.toHaveBeenCalledWith('/domains');
    expect(mocks.alert).toHaveBeenCalledWith(
      'Baci Pro',
      'Domains is available on Baci Pro.',
      expect.any(Array)
    );
  });
});
