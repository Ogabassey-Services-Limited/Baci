import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MenuScreen from '../../../app/(admin)/(tabs)/menu';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  customerInfo: null,
  isMerchantLoading: false,
  isRevenueCatPro: false,
  merchant: null as {
    plan_expires_at: string | null;
    plan_tier: string | null;
    premium_features: string[];
  } | null,
  push: vi.fn(),
  replace: vi.fn(),
  resetOnboarding: vi.fn(),
  signOut: vi.fn(),
  subscriptionCardProps: null as {
    isLoading: boolean;
    isPro: boolean;
  } | null,
  unregisterPush: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Alert: { alert: mocks.alert },
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { 'aria-label': accessibilityLabel, onClick: () => onPress?.() },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StatusBar: () => null,
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => children,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('@/components/settings/SubscriptionStatusCard', () => ({
  SubscriptionStatusCard: ({
    isLoading,
    isPro,
    onPress,
  }: {
    isLoading: boolean;
    isPro: boolean;
    onPress: () => void;
  }) => {
    mocks.subscriptionCardProps = { isLoading, isPro };

    return (
      <button type="button" onClick={onPress}>
        Subscription
      </button>
    );
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
}));

vi.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({ resetOnboarding: mocks.resetOnboarding }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: mocks.signOut }),
}));

vi.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({ unregisterPush: mocks.unregisterPush }),
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({
    customerInfo: mocks.customerInfo,
    isPro: mocks.isRevenueCatPro,
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    isLoading: mocks.isMerchantLoading,
    merchant: mocks.merchant,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#e5e7eb',
      card: '#fff',
      cardHover: '#f8fafc',
      error: '#dc2626',
      gold: '#b45309',
      goldLight: '#fef3c7',
      primary: '#2563eb',
      text: '#111827',
      textMuted: '#6b7280',
      textSecondary: '#4b5563',
    },
    isDark: false,
    shadows: { sm: {} },
  }),
}));

describe('MenuScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', false);
    vi.clearAllMocks();
    mocks.customerInfo = null;
    mocks.isMerchantLoading = false;
    mocks.isRevenueCatPro = false;
    mocks.merchant = {
      plan_expires_at: null,
      plan_tier: 'free',
      premium_features: [],
    };
    mocks.subscriptionCardProps = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders store and business navigation entries', () => {
    render(<MenuScreen />);

    expect(screen.getByText('Menu')).toBeTruthy();
    expect(screen.getByText('Domains')).toBeTruthy();
    expect(screen.getByText('Analytics')).toBeTruthy();
    expect(screen.getByText('Payment Methods')).toBeTruthy();
  });

  it('navigates to domains from the menu', () => {
    render(<MenuScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Domains. Custom domain settings' })
    );

    expect(mocks.push).toHaveBeenCalledWith('/domains');
  });

  it('navigates to negotiations from the menu', () => {
    render(<MenuScreen />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Negotiations. Manage price negotiation requests',
      })
    );

    expect(mocks.push).toHaveBeenCalledWith('/(admin)/negotiations');
  });

  it('passes database-backed Pro status to the subscription card', () => {
    mocks.merchant = {
      plan_expires_at: null,
      plan_tier: 'pro',
      premium_features: [],
    };

    render(<MenuScreen />);

    expect(mocks.subscriptionCardProps).toEqual({
      isLoading: false,
      isPro: true,
    });
  });

  it('passes a loading state while merchant subscription status loads', () => {
    mocks.isMerchantLoading = true;
    mocks.merchant = null;

    render(<MenuScreen />);

    expect(mocks.subscriptionCardProps).toEqual({
      isLoading: true,
      isPro: false,
    });
  });

  it('does not treat product-limit-only grants as full Pro card access', () => {
    mocks.merchant = {
      plan_expires_at: null,
      plan_tier: 'free',
      premium_features: ['product_limit'],
    };

    render(<MenuScreen />);

    expect(mocks.subscriptionCardProps).toEqual({
      isLoading: false,
      isPro: false,
    });
  });
});
