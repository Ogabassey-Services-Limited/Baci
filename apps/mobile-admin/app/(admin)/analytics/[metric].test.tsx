import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsDetailScreen from './[metric]';

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  useAnalyticsDetail: vi.fn(),
  useLocalSearchParams: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }),
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement('button', { onClick: () => onPress?.() }, children),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Share: { share: vi.fn() },
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
    G: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('g', null, children),
    Rect: () => null,
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('text', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: { Screen: () => React.createElement('div') },
    useLocalSearchParams: mocks.useLocalSearchParams,
    useRouter: () => ({ back: mocks.back }),
  };
});

vi.mock('@/hooks/useAnalyticsDetail', () => ({
  METRIC_CONFIG: {
    aov: { columns: [], title: 'Average Order Value' },
    profits: { columns: [], title: 'Profits' },
    revenue: { columns: [], title: 'Revenue' },
    sales: { columns: [], title: 'Sales' },
    vat: { columns: [], title: 'VAT Due' },
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
      background: '#fff',
      border: '#e5e7eb',
      card: '#fff',
      error: '#dc2626',
      primary: '#2563eb',
      text: '#111827',
      textMuted: '#6b7280',
      textOnPrimary: '#fff',
      textSecondary: '#4b5563',
    },
    isDark: false,
  }),
}));

describe('AnalyticsDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useLocalSearchParams.mockReturnValue({
      filterLabel: 'This year',
      metric: 'revenue',
    });
    mocks.useAnalyticsDetail.mockReturnValue({
      data: null,
      error: null,
      isError: false,
      isFetching: false,
      isLoading: true,
      refetch: vi.fn(),
    });
  });

  it('renders the selected metric loading state', () => {
    render(<AnalyticsDetailScreen />);

    expect(screen.getByText('This year')).toBeTruthy();
    expect(screen.getByText('Total:')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });
});
