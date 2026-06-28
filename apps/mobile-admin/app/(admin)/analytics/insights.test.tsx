import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsInsightsScreen from './insights';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useAnalyticsOverview: vi.fn(),
  useLocalSearchParams: vi.fn(),
  useMerchant: vi.fn(),
  useRevenueCat: vi.fn(),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: {
      Screen: () => React.createElement('div'),
    },
    useLocalSearchParams: mocks.useLocalSearchParams,
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <div role="progressbar" />,
  Pressable: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StatusBar: () => null,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock('@/components/analytics/analytics-insights.styles', () => ({
  styles: new Proxy(
    {},
    {
      get: (_target, property) => property,
    }
  ),
}));

vi.mock('@/components/billing/FeatureGateScreen', () => ({
  FeatureGateScreen: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: mocks.useMerchant,
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: mocks.useRevenueCat,
}));

vi.mock('@/hooks/useAnalyticsOverview', () => ({
  useAnalyticsOverview: mocks.useAnalyticsOverview,
}));

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (amount: number) => `NGN ${amount}`,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      error: '#dc2626',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#64748b',
      textOnPrimary: '#ffffff',
      textSecondary: '#475569',
    },
    isDark: false,
  }),
}));

describe('AnalyticsInsightsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMerchant.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        plan_expires_at: null,
        plan_tier: 'free',
        premium_features: [],
      },
    });
    mocks.useRevenueCat.mockReturnValue({ isPro: true });
    mocks.useLocalSearchParams.mockReturnValue({
      filterLabel: 'This month',
      kind: 'blog',
    });
    mocks.useAnalyticsOverview.mockReturnValue({
      data: {
        blog: {
          draftPosts: 1,
          publishedPosts: 3,
          topPost: { title: 'How to Sell Faster' },
          totalViews: 420,
        },
        brandBreakdown: [],
        customerBreakdown: [],
        salesByPaymentMethod: [],
      },
      error: null,
      isLoading: false,
      refetch: mocks.refetch,
    });
  });

  it('renders blog insight content for the selected period', () => {
    render(<AnalyticsInsightsScreen />);

    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.getByText('420')).toBeTruthy();
    expect(screen.getByText(/Top post: How to Sell Faster/i)).toBeTruthy();
  });

  it('renders a retryable error state', () => {
    mocks.useAnalyticsOverview.mockReturnValue({
      data: null,
      error: new Error('network unavailable'),
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<AnalyticsInsightsScreen />);

    expect(
      screen.getByText('Unable to load analytics right now.')
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Try again'));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it('does not mount the overview query for merchants without advanced analytics', () => {
    mocks.useRevenueCat.mockReturnValue({ isPro: false });

    render(<AnalyticsInsightsScreen />);

    expect(mocks.useAnalyticsOverview).not.toHaveBeenCalled();
  });
});
