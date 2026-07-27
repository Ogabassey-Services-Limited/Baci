import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomersScreen from './customers';

vi.mock('@shopify/flash-list', async () => {
  const React = await import('react');
  return {
    FlashList: ({
      data,
      renderItem,
      ListEmptyComponent,
      ListHeaderComponent,
    }: {
      data?: unknown[] | null;
      renderItem: (params: { item: unknown; index: number }) => React.ReactNode;
      ListEmptyComponent?: React.ReactNode;
      ListHeaderComponent?: React.ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        ListHeaderComponent,
        data && data.length > 0
          ? data.map((item: unknown, index: number) =>
              renderItem({ item, index })
            )
          : ListEmptyComponent
      ),
  };
});

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  return {
    default: () => React.createElement('div', null),
  };
});

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-router', () => ({
  router: { push: vi.fn(), replace: vi.fn() },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('expo-linking', () => ({
  openURL: vi.fn(),
  parse: vi.fn(() => ({ queryParams: {} })),
  createURL: vi.fn(() => 'baciadmin://'),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000000',
      backgroundLight: '#f2f2f7',
      card: '#1c1c1e',
      cardHover: '#2c2c2e',
      error: '#ff3b30',
      gold: '#e6b800',
      goldLight: '#fff9e6',
      primary: '#0a84ff',
      primaryLight: '#e6f2ff',
      success: '#34c759',
      successLight: '#eafaf1',
      text: '#ffffff',
      textSecondary: '#aeaeb2',
      warning: '#ff9500',
    },
    shadows: { sm: {} },
    isDark: true,
  }),
}));

const customerHookMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useCustomers: vi.fn(),
  useFailedOrders: vi.fn(),
  useCustomerStats: vi.fn(),
  useMerchant: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: customerHookMocks.invalidateQueries,
  }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: customerHookMocks.useCustomers,
  useCustomerStats: customerHookMocks.useCustomerStats,
  CustomerItem: () => null,
}));

vi.mock('@/hooks/useFailedOrders', () => ({
  useFailedOrders: customerHookMocks.useFailedOrders,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: customerHookMocks.useMerchant,
}));

/**
 * Colocated cover for the CustomersScreen follow-up error surface.
 *
 * Regression origin: the Follow Up tab reported a *failed* query as "All
 * recent transactions are successful!". See PR #3200 — an ambiguous
 * orders->transactions embed made every request fail with PostgREST
 * PGRST201, leaving `data` undefined and the success empty state on screen
 * while 145 orders awaited follow-up.
 *
 * The screen's broader rendering, tab, and pagination cases live in
 * `__tests__/admin/tabs/customers.test.tsx`; these are kept separate so
 * neither module exceeds the 300-line limit.
 */
describe('CustomersScreen follow-up error surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customerHookMocks.useCustomers.mockReturnValue({
      data: { pages: [{ customers: [] }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });
    customerHookMocks.useCustomerStats.mockReturnValue({
      data: { total: 0, newThisWeek: 0, retentionRate: 0 },
    });
    customerHookMocks.useMerchant.mockReturnValue({
      merchant: { id: 'merchant-1', payout_currency: 'NGN' },
    });
  });

  it('does not claim transactions are successful when the follow-up query errors', () => {
    // Arrange: the query throws, so `data` is undefined and the list is empty.
    customerHookMocks.useFailedOrders.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      refetch: vi.fn(),
    });

    // Act
    render(<CustomersScreen />);

    // Assert
    expect(
      screen.queryByText('All recent transactions are successful!')
    ).toBeNull();
    expect(screen.queryByText('No issues')).toBeNull();
    expect(screen.getByText("Couldn't load follow-ups")).toBeTruthy();
  });

  it('refetches follow-ups when the error state retry is pressed', () => {
    // Arrange
    const refetch = vi.fn();
    customerHookMocks.useFailedOrders.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      refetch,
    });
    render(<CustomersScreen />);

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading follow-ups' })
    );

    // Assert
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('still reports success when the query succeeds with no follow-ups', () => {
    // Arrange: the success path must survive the error branch being added.
    customerHookMocks.useFailedOrders.mockReturnValue({
      data: [],
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    // Act
    render(<CustomersScreen />);

    // Assert
    expect(screen.getByText('No issues')).toBeTruthy();
    expect(screen.queryByText("Couldn't load follow-ups")).toBeNull();
  });

  it('does not report no issues when merchant context fails and retries merchant context', () => {
    // Arrange: useFailedOrders is disabled without a merchant id, so its
    // undefined data must not be mistaken for a successful empty queue.
    customerHookMocks.useMerchant.mockReturnValue({
      merchant: null,
      isLoading: false,
      error: new Error('merchant context failed'),
    });
    customerHookMocks.useFailedOrders.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    // Act
    render(<CustomersScreen />);

    // Assert
    expect(screen.queryByText('No issues')).toBeNull();
    expect(screen.getByText('Failed to load store')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading follow-ups' })
    );

    expect(customerHookMocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
  });

  it('warns that rows are stale when a refresh fails over cached follow-ups', () => {
    // Arrange: React Query keeps the cached rows on a failed refetch, so the
    // empty state never renders and the staleness would go unannounced.
    customerHookMocks.useFailedOrders.mockReturnValue({
      data: [
        {
          attempt_count: 1,
          created_at: '2026-07-24T10:00:00.000Z',
          customer_email: 'ada@example.com',
          customer_id: 'customer-1',
          customer_name: 'Ada Buyer',
          customer_phone: '+2348012345678',
          id: 'order-1',
          order_number: 'ORD-001',
          payment_method: 'credit_direct',
          payment_status: 'bnpl_pending',
          total: 15000,
        },
      ],
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    // Act
    render(<CustomersScreen />);

    // Assert
    expect(
      screen.getByText("Couldn't refresh. Showing the last loaded follow-ups.")
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Retry loading follow-ups' })
    ).toBeTruthy();
  });

  it('disables the retry control while a retry is already in flight', () => {
    // Arrange: isLoading stays false once the query is in its error state, so
    // only isFetching distinguishes an in-flight retry.
    customerHookMocks.useFailedOrders.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: true,
      isLoading: false,
      refetch: vi.fn(),
    });

    // Act
    render(<CustomersScreen />);

    // Assert
    const retry = screen.getByRole('button', {
      name: 'Retry loading follow-ups',
    });
    expect(retry).toBeDisabled();
    expect(screen.getByText('Retrying…')).toBeTruthy();
  });
});
