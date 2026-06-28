import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsDetailScreen from './[metric]';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  router: {
    back: vi.fn(),
  },
  share: vi.fn(),
  useAnalyticsDetail: vi.fn(),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: {
      Screen: () => React.createElement('div'),
    },
    useLocalSearchParams: () => ({
      filterLabel: 'This month',
      metric: 'revenue',
    }),
    useRouter: () => mocks.router,
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
  Share: { share: mocks.share },
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
  G: ({ children }: { children?: ReactNode }) => <g>{children}</g>,
  Rect: () => <rect />,
  Text: ({ children }: { children?: ReactNode }) => <text>{children}</text>,
}));

vi.mock('@/components/billing/FeatureGateScreen', () => ({
  FeatureGateScreen: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('@/hooks/useAnalyticsDetail', () => ({
  METRIC_CONFIG: {
    revenue: {
      columns: [{ key: 'value', label: 'Revenue', format: 'currency' }],
      title: 'Revenue',
    },
  },
  useAnalyticsDetail: mocks.useAnalyticsDetail,
}));

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (amount: number) => `NGN ${amount}`,
    formatCompact: (amount: number) => `NGN ${amount}`,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      error: '#dc2626',
      errorLight: '#fee2e2',
      primary: '#2563eb',
      success: '#16a34a',
      successLight: '#dcfce7',
      text: '#0f172a',
      textMuted: '#64748b',
      textOnPrimary: '#ffffff',
      textSecondary: '#475569',
    },
    isDark: false,
  }),
}));

describe('AnalyticsDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAnalyticsDetail.mockReturnValue({
      data: {
        bestPeriod: { label: 'June', value: 120_000 },
        comparisonData: [],
        data: [{ label: 'June', value: 120_000 }],
        percentChange: 12.5,
        rangeLabel: 'This month',
        total: 120_000,
      },
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: mocks.refetch,
    });
  });

  it('renders the selected metric detail table', () => {
    render(<AnalyticsDetailScreen />);

    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.getByText('Total:')).toBeTruthy();
    expect(screen.getAllByText('NGN 120000').length).toBeGreaterThan(0);
    expect(screen.getByText('Compare vs previous period')).toBeTruthy();
    expect(screen.getByText('June')).toBeTruthy();
  });

  it('renders a retry action when the detail query fails before data loads', () => {
    mocks.useAnalyticsDetail.mockReturnValue({
      data: null,
      error: new Error('network unavailable'),
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<AnalyticsDetailScreen />);

    expect(screen.getByText('Unable to load revenue.')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry fetching analytics data' })
    );
    expect(mocks.refetch).toHaveBeenCalled();
  });
});
