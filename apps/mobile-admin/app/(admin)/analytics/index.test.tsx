import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsScreen from './index';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  refetchAnalytics: vi.fn(),
  router: {
    back: vi.fn(),
    push: vi.fn(),
  },
  useAnalyticsOverview: vi.fn(),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: {
      Screen: () => React.createElement('div'),
    },
    useRouter: () => mocks.router,
  };
});

vi.mock('@react-native-community/datetimepicker', () => ({
  default: () => <input aria-label="date-picker" />,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <div role="progressbar" />,
  Alert: { alert: mocks.alert },
  Modal: ({
    children,
    visible,
  }: {
    children?: ReactNode;
    visible?: boolean;
  }) => (visible ? <div>{children}</div> : null),
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
  RefreshControl: () => null,
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

vi.mock('react-native-svg', () => ({
  default: ({ children }: { children?: ReactNode }) => (
    <svg aria-hidden="true">{children}</svg>
  ),
  Path: () => <path />,
}));

vi.mock('@/components/analytics/ReportSelectionModal', () => ({
  default: ({ visible }: { visible?: boolean }) =>
    visible ? <div>Report selection modal</div> : null,
}));

vi.mock('@/hooks/useAnalyticsOverview', () => ({
  useAnalyticsOverview: mocks.useAnalyticsOverview,
}));

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatCompact: (amount: number) => `NGN ${amount}`,
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: { business_name: 'Baci Test Store', id: 'merchant-1' },
  }),
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({
    isPro: true,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      cardHover: '#f1f5f9',
      error: '#dc2626',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      success: '#16a34a',
      successLight: '#dcfce7',
      text: '#0f172a',
      textMuted: '#64748b',
      textOnPrimary: '#ffffff',
      textSecondary: '#475569',
      warning: '#f59e0b',
      warningLight: '#fef3c7',
    },
    isDark: false,
  }),
}));

vi.mock('@/lib/feature-gates', () => ({
  baciFeatureGates: {
    hasFeature: () => true,
  },
}));

function makeAnalyticsOverview() {
  return {
    blog: {
      draftPosts: 1,
      publishedPosts: 3,
      totalViews: 420,
    },
    brandBreakdown: [],
    chartData: [{ orders: 2, profit: 30_000, revenue: 120_000, tax: 7_500 }],
    customerBreakdown: [],
    salesByPaymentMethod: [],
    summary: {
      aov: { value: 60_000 },
      customers: { value: 2 },
      grossMargin: { value: 25 },
      profit: { value: 30_000 },
      revenue: { value: 120_000 },
      sales: { value: 2 },
      taxDue: { value: 7_500 },
      totalUnitsSold: 3,
    },
    topBrand: { name: 'Samsung', revenue: 90_000 },
    topCustomer: { name: 'Ada', value: 2 },
    topPaymentMethod: { name: 'card', value: 80 },
    topProducts: [{ id: 'p1', name: 'Galaxy S26', revenue: 120_000 }],
  };
}

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAnalyticsOverview.mockReturnValue({
      data: makeAnalyticsOverview(),
      error: null,
      isLoading: false,
      refetch: mocks.refetchAnalytics,
    });
  });

  it('renders the analytics overview metrics', () => {
    render(<AnalyticsScreen />);

    expect(screen.getByText('Analytics')).toBeTruthy();
    expect(screen.getByText('Revenue')).toBeTruthy();
    expect(screen.getByText('Sales')).toBeTruthy();
    expect(screen.getByText('Average Order Value')).toBeTruthy();
    expect(screen.getByText('Samsung')).toBeTruthy();
    expect(screen.getByText('Galaxy S26')).toBeTruthy();
  });

  it('routes metric rows to the advanced detail screen', () => {
    render(<AnalyticsScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Revenue/i }));

    expect(mocks.router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ metric: 'revenue' }),
        pathname: '/analytics/[metric]',
      })
    );
  });
});
