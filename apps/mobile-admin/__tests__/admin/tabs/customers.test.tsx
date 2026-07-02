import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomersScreen from '@/app/(admin)/(tabs)/customers';

// Mock FlashList
vi.mock('@shopify/flash-list', async () => {
  const React = await import('react');
  return {
    FlashList: ({
      data,
      renderItem,
      ListEmptyComponent,
    }: {
      data?: unknown[] | null;
      renderItem: (params: { item: unknown; index: number }) => React.ReactNode;
      ListEmptyComponent?: React.ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        data && data.length > 0
          ? data.map((item: unknown, index: number) =>
              renderItem({ item, index })
            )
          : ListEmptyComponent
      ),
  };
});

// Mock other components/dependencies
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
      card: '#1c1c1e',
      cardHover: '#2c2c2e',
      text: '#ffffff',
      textSecondary: '#aeaeb2',
      gold: '#e6b800',
      goldLight: '#fff9e6',
      success: '#34c759',
      successLight: '#eafaf1',
      backgroundLight: '#f2f2f7',
      error: '#ff3b30',
      warning: '#ff9500',
    },
    shadows: {
      sm: {},
    },
    isDark: true,
  }),
}));

const customerHookMocks = vi.hoisted(() => ({
  useCustomers: vi.fn(),
  useFailedOrders: vi.fn(),
  useCustomerStats: vi.fn(),
  useMerchant: vi.fn(),
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

describe('CustomersScreen UI rendering', () => {
  const fetchNextPage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    customerHookMocks.useCustomers.mockReturnValue({
      data: { pages: [{ customers: [] }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage,
      refetch: vi.fn(),
    });

    customerHookMocks.useFailedOrders.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });

    customerHookMocks.useCustomerStats.mockReturnValue({
      data: { total: 0, newThisWeek: 0, retentionRate: 0 },
    });

    customerHookMocks.useMerchant.mockReturnValue({
      merchant: { id: 'merchant-1', payout_currency: 'NGN' },
    });
  });

  it('renders customers screen successfully', () => {
    const { getByText } = render(<CustomersScreen />);
    expect(getByText('Customers')).toBeTruthy();
  });

  it('opens customer tabs and passes the selected customer type filter', () => {
    render(<CustomersScreen />);

    expect(customerHookMocks.useCustomers).toHaveBeenLastCalledWith({
      customerType: undefined,
      search: '',
    });

    fireEvent.click(screen.getByRole('tab', { name: 'People' }));

    expect(customerHookMocks.useCustomers).toHaveBeenLastCalledWith({
      customerType: 'individual',
      search: '',
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Companies' }));

    expect(customerHookMocks.useCustomers).toHaveBeenLastCalledWith({
      customerType: 'company',
      search: '',
    });
  });
});
