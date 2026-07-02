import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrdersScreen from './OrdersScreen';
import { mockColors, mockOrder, mockShadows } from './orders-screen-test-utils';

// Render the mock label through a Text-named host so static analysis treats it
// as a React Native text node; in jsdom this is a plain span, so getByText
// behavior is unchanged.
const Text = ({ children }: { children?: ReactNode }) => (
  <span>{children}</span>
);

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
  updateStatus: vi.fn(),
  useOrdersCalls: [] as unknown[][],
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
  useOrderCounts: () => ({ data: { all: 2, paid: 1, pending: 1 } }),
}));

vi.mock('@/hooks/useOrders', () => ({
  useOrders: (...args: unknown[]) => {
    mocks.useOrdersCalls.push(args);
    return {
      data: { pages: [{ orders: [mockOrder], nextCursor: null }] },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: null,
    };
  },
  useUpdateOrderStatus: () => ({
    isPending: false,
    mutateAsync: mocks.updateStatus,
  }),
}));

vi.mock('./OrdersModals', () => ({
  OrdersModals: ({ showReportModal }: { showReportModal: boolean }) =>
    showReportModal ? (
      <div>
        <Text>Report modal open</Text>
      </div>
    ) : null,
}));

vi.mock('./OrdersStatusDropdown', () => ({
  OrdersStatusDropdown: () => null,
}));

vi.mock('./OrdersScrollSurface', () => ({
  OrdersScrollSurface: ({
    onDismissInsight,
    onFilterSelect,
    renderItem,
  }: {
    onDismissInsight?: () => void;
    onFilterSelect: (filter: 'all' | 'paid' | 'pending' | 'processing') => void;
    renderItem: ({ item }: { item: unknown }) => ReactNode;
  }) => (
    <div>
      <button onClick={onDismissInsight} type="button">
        Mock list scroll
      </button>
      <button onClick={() => onFilterSelect('paid')} type="button">
        Paid
      </button>
      <button onClick={() => onFilterSelect('pending')} type="button">
        Pending
      </button>
      <button onClick={() => onFilterSelect('processing')} type="button">
        Processing
      </button>
      {renderItem({ item: { type: 'item', id: 'order-1', order: mockOrder } })}
    </div>
  ),
}));

describe('OrdersScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useOrdersCalls.length = 0;
  });

  it('renders orders and opens create-order navigation', () => {
    render(<OrdersScreen />);

    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('ORD-1001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create new order' }));

    expect(mocks.push).toHaveBeenCalledWith('/order/new');
  });

  it('hides AI insights when the order list reports a scroll dismissal', () => {
    render(<OrdersScreen />);

    expect(screen.getByText('AI INSIGHTS')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mock list scroll' }));

    expect(screen.queryByText('AI INSIGHTS')).not.toBeInTheDocument();
  });

  it('maps the paid filter tab to payment-status filtering', () => {
    render(<OrdersScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Paid' }));

    expect(mocks.useOrdersCalls.at(-1)).toEqual(['all', '', null, 'paid']);
  });

  it('keeps the pending filter mapped to fulfillment status', () => {
    render(<OrdersScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    expect(mocks.useOrdersCalls.at(-1)).toEqual(['pending', '', null, 'all']);
  });

  it('keeps the existing processing filter mapped to fulfillment status', () => {
    render(<OrdersScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Processing' }));

    expect(mocks.useOrdersCalls.at(-1)).toEqual([
      'processing',
      '',
      null,
      'all',
    ]);
  });
});
