import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMerchant: vi.fn(),
  useOrders: vi.fn(),
  useOrderCounts: vi.fn(),
  mutateAsync: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  class AnimatedValue {
    interpolate() {
      return 0;
    }
  }

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: { alert: vi.fn() },
    Animated: {
      Value: AnimatedValue,
      timing: () => ({ start: () => undefined }),
      View: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', null, children),
    },
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        'button',
        { onClick: onPress, 'aria-label': accessibilityLabel },
        children
      ),
    RefreshControl: () => null,
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    SectionList: ({
      sections,
      ListEmptyComponent,
    }: {
      sections?: Array<{ data?: unknown[] }>;
      ListEmptyComponent?: React.ReactNode;
    }) => {
      const hasItems = (sections ?? []).some(
        (section) => (section.data?.length ?? 0) > 0
      );
      return React.createElement(
        'div',
        null,
        hasItems ? null : ListEmptyComponent
      );
    },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      value,
      onChangeText,
      placeholder,
    }: {
      value?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
    }) =>
      React.createElement('input', {
        value: value ?? '',
        placeholder,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');

  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('expo-router', () => ({
  router: {
    push: mocks.push,
  },
}));

vi.mock('@/components/ui/DateRangePicker', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/OrderReportModal', () => ({
  default: () => null,
}));

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: mocks.useMerchant,
}));

vi.mock('@/hooks/useOrderCounts', () => ({
  useOrderCounts: mocks.useOrderCounts,
}));

vi.mock('@/hooks/useOrders', () => ({
  useOrders: mocks.useOrders,
  useUpdateOrderStatus: () => ({
    isPending: false,
    mutateAsync: mocks.mutateAsync,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#0D0D1A',
      backgroundLight: '#12121F',
      card: '#1A1A2E',
      cardHover: '#252542',
      border: '#2A2A40',
      text: '#FFFFFF',
      textSecondary: '#9CA3AF',
      textMuted: '#6B7280',
      primary: '#4A90D9',
      textOnPrimary: '#FFFFFF',
      gold: '#F0BF58',
      goldLight: 'rgba(240, 191, 88, 0.15)',
      error: '#EF4444',
      pending: '#F59E0B',
      processing: '#3B82F6',
      shipped: '#8B5CF6',
      delivered: '#22C55E',
      cancelled: '#EF4444',
      returned: '#A855F7',
      success: '#22C55E',
      warning: '#F59E0B',
      info: '#3B82F6',
    },
    shadows: {
      sm: {},
      lg: {},
    },
    isDark: true,
  }),
}));

vi.mock('@/utils/date-utils', () => ({
  groupOrdersByRelativeDate: () => [],
}));

vi.mock('@/utils/export-orders', () => ({
  orderExportTools: {
    exportOrdersRPC: vi.fn(),
  },
}));

import OrdersScreen from '../../../app/(admin)/(tabs)/orders';

describe('OrdersScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMerchant.mockReturnValue({
      storeUrl: 'ogabassey.com',
      merchant: {
        id: 'merchant-1',
        business_name: 'Ogabassey',
        payout_currency: 'NGN',
        logo_url: null,
      },
      isLoading: false,
      error: null,
    });
    mocks.useOrders.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: null,
    });
    mocks.useOrderCounts.mockReturnValue({ data: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the merchant error state instead of the empty state', () => {
    mocks.useMerchant.mockReturnValue({
      storeUrl: '',
      merchant: null,
      isLoading: false,
      error: new Error('merchant failed'),
    });

    render(<OrdersScreen />);

    expect(screen.getByText('Failed to load store')).toBeTruthy();
    expect(
      screen.getByText(
        'We could not load your store context for this account. Try again or sign in again if the issue persists.'
      )
    ).toBeTruthy();
    expect(screen.queryByText('No orders found')).toBeNull();
  });

  it('renders the orders error state and retries the relevant queries', () => {
    mocks.useOrders.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: new Error('orders failed'),
    });

    render(<OrdersScreen />);

    expect(screen.getByText('Failed to load orders')).toBeTruthy();
    expect(screen.queryByText('No orders found')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['orders', 'merchant-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['order-counts', 'merchant-1'],
    });
  });

  it('retries only the merchant query when merchant context is missing', () => {
    mocks.useMerchant.mockReturnValue({
      storeUrl: '',
      merchant: null,
      isLoading: false,
      error: null,
    });
    mocks.useOrders.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: new Error('orders failed'),
    });

    render(<OrdersScreen />);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['orders', 'merchant-1'],
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['order-counts', 'merchant-1'],
    });
  });

  it('keeps the empty state for a genuine zero-orders result', () => {
    render(<OrdersScreen />);

    expect(screen.getByText('No orders found')).toBeTruthy();
    expect(
      screen.getByText('Orders will appear here when customers place them')
    ).toBeTruthy();
  });

  it('renders the insight card above the search bar and keeps filters below search', () => {
    mocks.useOrderCounts.mockReturnValue({
      data: {
        all: 8,
        pending: 4,
        processing: 2,
        shipped: 1,
        delivered: 1,
        cancelled: 0,
        returned: 0,
      },
    });

    render(<OrdersScreen />);

    const viewPendingButton = screen.getByLabelText('View 4 pending orders');
    const searchInput = screen.getByPlaceholderText(
      'Search orders or customers...'
    );
    const pendingFilter = screen.getByLabelText('Pending orders: 4');

    expect(
      viewPendingButton.compareDocumentPosition(searchInput) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      searchInput.compareDocumentPosition(pendingFilter) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
