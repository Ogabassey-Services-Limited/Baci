import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/hooks/useOrders';
import { groupOrdersByRelativeDate } from '@/utils/date-utils';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMerchant: vi.fn(),
  useOrders: vi.fn(),
  useOrderCounts: vi.fn(),
  useAiInsights: vi.fn(),
  mutateAsync: vi.fn(),
  push: vi.fn(),
  flashListProps: [] as Array<{ stickyHeaderIndices?: number[] }>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');

  const makeSharedValue = (initial: unknown) => {
    const shared = { value: initial };

    return {
      get value() {
        return shared.value;
      },
      set value(nextValue: unknown) {
        shared.value = nextValue;
      },
      get() {
        return shared.value;
      },
      set(nextValue: unknown) {
        shared.value = nextValue;
      },
    };
  };

  return {
    default: {
      View: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', null, children),
      createAnimatedComponent: vi.fn((Component: unknown) => Component),
    },
    interpolate: (value: number) => value,
    useAnimatedScrollHandler: (handler: unknown) => handler,
    useAnimatedStyle: (callback: () => object) => callback(),
    useSharedValue: makeSharedValue,
    withTiming: (value: unknown) => value,
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');

  class AnimatedValue {
    interpolate() {
      return 0;
    }
  }

  return {
    StatusBar: () => null,
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: { alert: vi.fn() },
    Animated: {
      Value: AnimatedValue,
      timing: () => ({ start: () => undefined }),
      createAnimatedComponent: vi.fn((c) => c),
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

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),

    default: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
    __esModule: true,
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

vi.mock('@/components/ui/haptics', () => ({
  triggerLightHaptic: vi.fn(),
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

vi.mock('@/hooks/useAiInsights', () => ({
  useAiInsights: mocks.useAiInsights,
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
  groupOrdersByRelativeDate: vi.fn(() => []),
}));

vi.mock('@/utils/export-orders', () => ({
  orderExportTools: {
    exportOrdersRPC: vi.fn(),
  },
}));

vi.mock('@shopify/flash-list', async () => {
  const React = await import('react');

  type FlashListMockProps = {
    data?: unknown[];
    keyExtractor?: (item: unknown, index: number) => number | string;
    ListEmptyComponent?: ComponentType | ReactNode;
    ListFooterComponent?: ComponentType | ReactNode;
    renderItem?: (info: { index: number; item: unknown }) => ReactNode;
    stickyHeaderIndices?: number[];
  };

  return {
    FlashList: ({
      data = [],
      renderItem,
      keyExtractor,
      ListEmptyComponent,
      ListFooterComponent,
      stickyHeaderIndices,
    }: FlashListMockProps) => {
      mocks.flashListProps.push({ stickyHeaderIndices });
      const renderMaybeComponent = (
        ComponentOrNode: ComponentType | ReactNode | undefined
      ) => {
        if (!ComponentOrNode) return null;
        return typeof ComponentOrNode === 'function'
          ? React.createElement(ComponentOrNode as ComponentType)
          : ComponentOrNode;
      };

      return React.createElement(
        'div',
        null,
        data.length > 0
          ? data.map((item, index) =>
              React.createElement(
                React.Fragment,
                { key: keyExtractor?.(item, index) ?? index },
                renderItem?.({ item, index })
              )
            )
          : renderMaybeComponent(ListEmptyComponent),
        renderMaybeComponent(ListFooterComponent)
      );
    },
  };
});

import OrdersScreen from '../../../app/(admin)/(tabs)/orders';

describe('OrdersScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flashListProps.length = 0;
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
    mocks.useAiInsights.mockReturnValue({
      data: {
        insights: [
          {
            title: 'Verify Pending Shipments',
            description:
              'There are 503 unfulfilled orders. Shipped items prompt positive customer reviews.',
            type: 'opportunity',
            priority: 'high',
            action: 'Fulfill outstanding pending orders',
          },
        ],
      },
      isLoading: false,
      refetch: vi.fn(),
    });
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
    mocks.useAiInsights.mockReturnValue({
      data: null,
      isLoading: false,
      refetch: vi.fn(),
    });
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

  it('renders section headers and order items correctly in flat structure', () => {
    const mockOrders = [
      {
        id: 'order-1',
        created_at: '2026-06-09T12:00:00Z',
        shipping_status: 'pending',
        payment_status: 'paid',
        total: 10000,
        currency: 'NGN',
        order_number: 'ORD-1001',
        customer_name: 'John Doe',
        items_count: 2,
        payment_method: 'card',
        channel: 'web',
      },
      {
        id: 'order-2',
        created_at: '2026-06-08T12:00:00Z',
        shipping_status: 'shipped',
        payment_status: 'paid',
        total: 25000,
        currency: 'NGN',
        order_number: 'ORD-1002',
        customer_name: 'Jane Smith',
        items_count: 1,
        payment_method: 'transfer',
        channel: 'whatsapp',
      },
    ] as unknown as Order[];

    mocks.useOrders.mockReturnValue({
      data: {
        pages: [{ orders: mockOrders, nextCursor: null }],
        pageParams: [null],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: null,
    });

    vi.mocked(groupOrdersByRelativeDate).mockReturnValue([
      { title: 'Today', data: [mockOrders[0]] },
      { title: 'Yesterday', data: [mockOrders[1]] },
    ]);

    render(<OrdersScreen />);

    // Section headers should render
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();

    // Order details should render
    expect(screen.getByText('ORD-1001')).toBeTruthy();
    expect(screen.getByText('ORD-1002')).toBeTruthy();
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('Jane Smith')).toBeTruthy();
    expect(
      mocks.flashListProps[mocks.flashListProps.length - 1]?.stickyHeaderIndices
    ).toEqual([0, 2]);
  });

  it('renders pagination footer when isFetchingNextPage is true', () => {
    mocks.useOrders.mockReturnValue({
      data: {
        pages: [{ orders: [], nextCursor: 'next-page' }],
        pageParams: [null],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: true,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
      error: null,
    });

    render(<OrdersScreen />);
    expect(screen.getByText('loading')).toBeTruthy();
  });

  it('renders Gemma AI insights and actionable checklist TODOs', () => {
    render(<OrdersScreen />);
    expect(screen.getByText('AI INSIGHTS')).toBeTruthy();
    expect(screen.getByText('Verify Pending Shipments')).toBeTruthy();
    expect(
      screen.getByText(
        'There are 503 unfulfilled orders. Shipped items prompt positive customer reviews.'
      )
    ).toBeTruthy();
    expect(screen.getByText('Fulfill outstanding pending orders')).toBeTruthy();
  });
});
