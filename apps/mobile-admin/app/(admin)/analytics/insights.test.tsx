import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useAnalyticsOverview: vi.fn(),
  useLocalSearchParams: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('div', { role: 'progressbar' }),
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          onClick: () => onPress?.(),
        },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
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
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      primary: '#2563eb',
      text: '#111',
      textMuted: '#666',
      textOnPrimary: '#fff',
      textSecondary: '#555',
    },
    isDark: false,
  }),
}));

import AnalyticsInsightsScreen from './insights';

describe('AnalyticsInsightsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('renders a loading state', () => {
    mocks.useAnalyticsOverview.mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
      refetch: mocks.refetch,
    });

    render(<AnalyticsInsightsScreen />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders a retryable error state', () => {
    mocks.useAnalyticsOverview.mockReturnValue({
      data: null,
      error: new Error('boom'),
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<AnalyticsInsightsScreen />);

    expect(
      screen.getByText('Unable to load analytics right now.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Try again'));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it('renders blog analytics success content', () => {
    render(<AnalyticsInsightsScreen />);

    expect(screen.getByText('420')).toBeInTheDocument();
    expect(
      screen.getByText(/Top post: How to Sell Faster/i)
    ).toBeInTheDocument();
    expect(screen.getByText('This month')).toBeInTheDocument();
  });

  it('renders ranked rows for non-blog insights', () => {
    mocks.useLocalSearchParams.mockReturnValue({
      filterLabel: 'This month',
      kind: 'brands',
    });
    mocks.useAnalyticsOverview.mockReturnValue({
      data: {
        blog: null,
        brandBreakdown: [
          { name: 'Apple', revenue: 120000, value: 120000 },
          { name: 'Samsung', revenue: 80000, value: 80000 },
        ],
        customerBreakdown: [],
        salesByPaymentMethod: [],
      },
      error: null,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<AnalyticsInsightsScreen />);

    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('NGN 120000')).toBeInTheDocument();
    expect(screen.getByText('Samsung')).toBeInTheDocument();
    expect(screen.getByText('NGN 80000')).toBeInTheDocument();
  });

  it('renders the non-blog empty state when no ranked rows exist', () => {
    mocks.useLocalSearchParams.mockReturnValue({
      filterLabel: 'This month',
      kind: 'brands',
    });
    mocks.useAnalyticsOverview.mockReturnValue({
      data: {
        blog: null,
        brandBreakdown: [],
        customerBreakdown: [],
        salesByPaymentMethod: [],
      },
      error: null,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<AnalyticsInsightsScreen />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(
      screen.getByText('Ranked breakdown for This month')
    ).toBeInTheDocument();
  });

  it('renders blog analytics without a top-post row when no top post exists', () => {
    mocks.useAnalyticsOverview.mockReturnValue({
      data: {
        blog: {
          draftPosts: 0,
          publishedPosts: 1,
          topPost: null,
          totalViews: 12,
        },
        brandBreakdown: [],
        customerBreakdown: [],
        salesByPaymentMethod: [],
      },
      error: null,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<AnalyticsInsightsScreen />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.queryByText(/Top post:/i)).not.toBeInTheDocument();
  });

  it('shows the loading indicator while stale analytics data is present', () => {
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
      isLoading: true,
      refetch: mocks.refetch,
    });

    render(<AnalyticsInsightsScreen />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('420')).toBeInTheDocument();
  });
});
