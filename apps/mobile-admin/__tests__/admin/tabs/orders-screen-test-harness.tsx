import { cleanup, render } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { Alert } from 'react-native';
import { vi } from 'vitest';
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
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
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
      onPress?: (event: {
        nativeEvent: { pageX: number; pageY: number; target: number };
        stopPropagation: () => void;
        target: number;
      }) => void;
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        'button',
        {
          onClick: () =>
            onPress?.({
              nativeEvent: { pageX: 220, pageY: 180, target: 1 },
              stopPropagation: () => undefined,
              target: 1,
            }),
          'aria-label': accessibilityLabel,
        },
        children
      ),
    RefreshControl: () => null,
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
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
vi.mock('expo-router', () => ({ router: { push: mocks.push } }));
vi.mock('@/components/ui/DateRangePicker', () => ({ default: () => null }));
vi.mock('@/components/ui/OrderReportModal', () => ({ default: () => null }));
vi.mock('@/components/ui/haptics', () => ({ triggerLightHaptic: vi.fn() }));
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));
vi.mock('@/hooks/useMerchant', () => ({ useMerchant: mocks.useMerchant }));
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
    shadows: { sm: {}, lg: {} },
    isDark: true,
  }),
}));
vi.mock('@/utils/date-utils', () => ({
  groupOrdersByRelativeDate: vi.fn(() => []),
}));
vi.mock('@/utils/export-orders', () => ({
  orderExportTools: { exportOrdersRPC: vi.fn() },
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
export const ordersScreenTestHarness = {
  alert: Alert,
  cleanup,
  groupedDateMock: vi.mocked(groupOrdersByRelativeDate),
  mocks,
  render: () => render(<OrdersScreen />),
  reset: () => {
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
  },
};
