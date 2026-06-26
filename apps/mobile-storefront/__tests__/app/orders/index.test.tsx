import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import OrdersScreen from '@/app/orders';

interface MockStorefrontScreenShellProps {
  children?: ReactNode;
  edges?: readonly string[];
}

type MockAuthState = {
  customer: { id: string } | null;
  user: { id: string } | null;
};

type MockOrdersListControllerResult = {
  error: string | null;
  fetchOrders: jest.Mock;
  filteredOrders: unknown[];
  handleRefresh: jest.Mock;
  isLoading: boolean;
  isRefreshing: boolean;
  orderFilters: unknown[];
  orders: unknown[];
  searchQuery: string;
  selectedFilter: string;
  setSearchQuery: jest.Mock;
  setSelectedFilter: jest.Mock;
};

const EXPECTED_SHELL_EDGES = ['top', 'left', 'right'];
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockFetchOrders = jest.fn();
const mockHandleRefresh = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockSetSelectedFilter = jest.fn();
const mockUseAuthState = jest.fn<() => MockAuthState>();
const mockUseNetworkState = jest.fn();
const mockUseOrdersListController =
  jest.fn<() => MockOrdersListControllerResult>();
const mockUseRequireAuth = jest.fn();
const mockStorefrontScreenShell = jest.fn(
  ({ children }: MockStorefrontScreenShellProps) => (
    <View testID="storefront-screen-shell">{children}</View>
  )
);

function createControllerResult(
  overrides: Partial<MockOrdersListControllerResult> = {}
): MockOrdersListControllerResult {
  return {
    error: null,
    fetchOrders: mockFetchOrders,
    filteredOrders: [],
    handleRefresh: mockHandleRefresh,
    isLoading: false,
    isRefreshing: false,
    orderFilters: [],
    orders: [],
    searchQuery: '',
    selectedFilter: 'all',
    setSearchQuery: mockSetSearchQuery,
    setSelectedFilter: mockSetSelectedFilter,
    ...overrides,
  };
}

function expectOrdersShell() {
  expect(mockStorefrontScreenShell.mock.calls[0]?.[0].edges).toEqual(
    EXPECTED_SHELL_EDGES
  );
}

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return <Text>{`Redirect:${href}`}</Text>;
  },
  Stack: {
    Screen: () => null,
  },
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({ ListEmptyComponent }: { ListEmptyComponent?: ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return <View testID="orders-list">{ListEmptyComponent}</View>;
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return <View>{children}</View>;
  },
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/OfflineNotice', () => ({
  OfflineEmptyState: ({ title }: { title: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return <Text>{title}</Text>;
  },
  OfflineNotice: () => null,
}));

jest.mock('@/components/orders/OrdersFilterBar', () => ({
  OrdersFilterBar: () => null,
}));

jest.mock('@/components/orders/OrdersListEmptyState', () => ({
  OrdersListEmptyState: () => null,
}));

jest.mock('@/components/orders/OrdersListHeader', () => ({
  OrdersListHeader: () => null,
}));

jest.mock('@/components/orders/OrdersListItem', () => ({
  OrdersListItem: () => null,
}));

jest.mock('@/components/orders/use-orders-list-controller', () => ({
  useOrdersListController: () => mockUseOrdersListController(),
}));

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({
    children,
    ...props
  }: MockStorefrontScreenShellProps) =>
    mockStorefrontScreenShell({ children, ...props }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useRequireAuth: () => mockUseRequireAuth(),
}));

jest.mock('@/hooks/use-network-state', () => ({
  useNetworkState: () => mockUseNetworkState(),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: MockAuthState) => unknown) =>
    selector(mockUseAuthState()),
}));

describe('OrdersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(true);
    mockUseAuthState.mockReturnValue({
      customer: { id: 'customer-1' },
      user: { id: 'user-1' },
    });
    mockUseNetworkState.mockReturnValue({
      isOnline: true,
      onReconnect: jest.fn(),
    });
    mockUseOrdersListController.mockReturnValue(createControllerResult());
    mockUseRequireAuth.mockReturnValue({ redirectTo: null });
  });

  it('preserves the existing safe-area edges for the orders list', () => {
    render(<OrdersScreen />);

    expect(screen.getByText('My Orders')).toBeOnTheScreen();
    expectOrdersShell();
  });

  it('uses the shell while orders are loading', () => {
    mockUseOrdersListController.mockReturnValue(
      createControllerResult({ isLoading: true })
    );

    render(<OrdersScreen />);

    expectOrdersShell();
  });

  it('uses the shell for the signed-out state', () => {
    mockUseAuthState.mockReturnValue({ customer: null, user: null });

    render(<OrdersScreen />);

    expect(screen.getByText('Sign in to view orders')).toBeOnTheScreen();
    expectOrdersShell();
  });

  it('uses the shell for an offline error state', () => {
    mockUseNetworkState.mockReturnValue({
      isOnline: false,
      onReconnect: jest.fn(),
    });
    mockUseOrdersListController.mockReturnValue(
      createControllerResult({ error: 'Failed to load orders' })
    );

    render(<OrdersScreen />);

    expect(screen.getByText('Orders Unavailable')).toBeOnTheScreen();
    expectOrdersShell();
  });

  it('uses the shell for an online error state', () => {
    mockUseOrdersListController.mockReturnValue(
      createControllerResult({ error: 'Failed to load orders' })
    );

    render(<OrdersScreen />);

    expect(screen.getByText('Failed to load orders')).toBeOnTheScreen();
    expectOrdersShell();
  });

  it('keeps the auth redirect outside of a rendered shell', () => {
    mockUseRequireAuth.mockReturnValue({
      redirectTo: '/auth/login?returnTo=%2Forders',
    });

    render(<OrdersScreen />);

    expect(
      screen.getByText('Redirect:/auth/login?returnTo=%2Forders')
    ).toBeOnTheScreen();
    expect(mockStorefrontScreenShell).not.toHaveBeenCalled();
  });
});
