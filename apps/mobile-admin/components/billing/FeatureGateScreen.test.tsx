import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { FeatureGateScreen } from './FeatureGateScreen';

const gateState = vi.hoisted(() => ({
  isMerchantLoading: false,
  isPro: false,
  merchant: {
    plan_tier: 'free',
    premium_features: [] as string[],
  },
  router: {
    push: vi.fn(),
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => gateState.router,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    isLoading: gateState.isMerchantLoading,
    merchant: gateState.merchant,
  }),
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({
    isPro: gateState.isPro,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: LIGHT_COLORS,
  }),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('output', null, 'Loading'),
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          role: accessibilityRole,
          type: 'button',
          onClick: onPress,
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  return {
    SafeAreaView: ({ children }: { children?: ReactNode }) =>
      React.createElement('section', null, children),
  };
});

describe('FeatureGateScreen', () => {
  it('renders the protected content when RevenueCat says the merchant is pro', () => {
    gateState.isPro = true;
    gateState.merchant = { plan_tier: 'free', premium_features: [] };

    render(
      <FeatureGateScreen
        description="Connect branded domains."
        feature="custom_domain"
        title="Custom domains are a Baci Pro feature"
      >
        <span>Protected domains content</span>
      </FeatureGateScreen>
    );

    expect(screen.getByText('Protected domains content')).toBeInTheDocument();
  });

  it('renders the upgrade card when the merchant lacks the feature', () => {
    gateState.isPro = false;
    gateState.merchant = { plan_tier: 'free', premium_features: [] };

    render(
      <FeatureGateScreen
        description="Connect branded domains."
        feature="custom_domain"
        title="Custom domains are a Baci Pro feature"
      >
        <span>Protected domains content</span>
      </FeatureGateScreen>
    );

    expect(
      screen.queryByText('Protected domains content')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Custom domains are a Baci Pro feature')
    ).toBeInTheDocument();
  });
});
