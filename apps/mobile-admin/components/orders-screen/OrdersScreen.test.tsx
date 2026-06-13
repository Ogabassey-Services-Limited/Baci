import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import OrdersScreen from './OrdersScreen';
import { mockColors, mockOrder, mockShadows } from './orders-screen-test-utils';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('expo-router', () => ({
  router: { push: mocks.push },
}));

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ colors: mockColors, shadows: mockShadows, isDark: false }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: {
      id: 'merchant-1',
      business_name: 'Baci',
      payout_currency: 'NGN',
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useAiInsights', () => ({
  useAiInsights: () => ({
    data: { insights: [] },
    isLoading: false,
    refetch: mocks.refetch,
  }),
}));

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('@/hooks/useOrderCounts', () => ({
  useOrderCounts: () => ({ data: { all: 1, pending: 1 } }),
}));

vi.mock('@/hooks/useOrders', () => ({
  useOrders: () => ({
    data: { pages: [{ orders: [mockOrder], nextCursor: null }] },
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    error: null,
  }),
  useUpdateOrderStatus: () => ({
    isPending: false,
    mutateAsync: mocks.updateStatus,
  }),
}));

vi.mock('./OrdersModals', () => ({
  OrdersModals: ({ showReportModal }: { showReportModal: boolean }) =>
    showReportModal ? <div>Report modal open</div> : null,
}));

vi.mock('./OrdersStatusDropdown', () => ({
  OrdersStatusDropdown: () => null,
}));

vi.mock('./OrdersScrollSurface', () => ({
  OrdersScrollSurface: ({
    renderItem,
  }: {
    renderItem: ({ item }: { item: unknown }) => ReactNode;
  }) => (
    <div>
      {renderItem({ item: { type: 'item', id: 'order-1', order: mockOrder } })}
    </div>
  ),
}));

describe('OrdersScreen', () => {
  it('renders orders and opens create-order navigation', () => {
    render(<OrdersScreen />);

    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('ORD-1001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create new order' }));

    expect(mocks.push).toHaveBeenCalledWith('/order/new');
  });
});
