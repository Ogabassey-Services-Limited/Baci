import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsScreen from './index';

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
  useAnalyticsOverview: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }),
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible?: boolean;
    }) => (visible ? React.createElement('div', null, children) : null),
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement('button', { onClick: () => onPress?.() }, children),
    RefreshControl: () => null,
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

vi.mock('react-native-svg', async () => {
  const React = await import('react');
  return {
    default: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('svg', null, children),
    Path: () => null,
  };
});

vi.mock('@react-native-community/datetimepicker', () => ({
  default: () => null,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: { Screen: () => React.createElement('div') },
    useRouter: () => ({ back: mocks.back, push: mocks.push }),
  };
});

vi.mock('@/components/analytics/ReportSelectionModal', () => ({
  default: () => null,
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
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#e5e7eb',
      card: '#fff',
      error: '#dc2626',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      text: '#111827',
      textMuted: '#6b7280',
      textOnPrimary: '#fff',
      textSecondary: '#4b5563',
      warning: '#d97706',
      warningLight: '#fef3c7',
    },
    isDark: false,
  }),
}));

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAnalyticsOverview.mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
      refetch: mocks.refetch,
    });
  });

  it('renders the analytics header and loading state', () => {
    render(<AnalyticsScreen />);

    expect(screen.getByText('Analytics')).toBeTruthy();
    expect(screen.getByText('Report')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('renders populated analytics overview data', () => {
    mocks.useAnalyticsOverview.mockReturnValue({
      data: {
        blog: { publishedPosts: 2, totalViews: 1200 },
        chartData: [
          { orders: 4, profit: 35000, revenue: 100000, tax: 7500 },
          { orders: 3, profit: 25000, revenue: 80000, tax: 6000 },
        ],
        summary: {
          aov: { value: 25000 },
          customers: { value: 5 },
          grossMargin: { value: 35 },
          profit: { value: 60000 },
          revenue: { value: 180000 },
          sales: { value: 7 },
          taxDue: { value: 13500 },
          totalUnitsSold: 9,
        },
        topBrand: { name: 'Samsung', revenue: 120000 },
        topCustomer: { name: 'Customer Example', value: 3 },
        topPaymentMethod: { name: 'Transfer', value: 80 },
        topProducts: [{ name: 'Galaxy Fold 5', revenue: 120000 }],
      },
      error: null,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<AnalyticsScreen />);

    expect(screen.getByText('Revenue')).toBeTruthy();
    expect(screen.getByText('NGN 180000')).toBeTruthy();
    expect(screen.getByText('Galaxy Fold 5')).toBeTruthy();
  });

  it('renders analytics retry state when overview loading fails', () => {
    mocks.useAnalyticsOverview.mockReturnValue({
      data: null,
      error: new Error('Network unavailable'),
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<AnalyticsScreen />);

    expect(
      screen.getByText('Unable to load analytics right now.')
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Try again'));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
