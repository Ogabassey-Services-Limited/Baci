import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useOrdersListController } from './use-orders-list-controller';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: jest.fn() }),
}));

type MockOrderRow = {
  created_at: string;
  discount_amount: number;
  id: string;
  order_items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  order_number: string;
  payment_status: string;
  shipping_fee: number;
  shipping_status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
};

function setSupabaseRows(
  rows: MockOrderRow[],
  error: { message: string } | null
) {
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        order: async () => ({
          data: rows,
          error,
        }),
      }),
    }),
  });
}

function createMockOrderRow(
  overrides: Partial<MockOrderRow> & { id: string; order_number: string },
  itemName: string
): MockOrderRow {
  const { id, order_number, ...rest } = overrides;

  return {
    created_at: '2026-05-01T12:00:00.000Z',
    discount_amount: 0,
    id,
    order_items: [
      {
        id: `${id}-item`,
        name: itemName,
        price: 470000,
        quantity: 1,
      },
    ],
    order_number,
    payment_status: 'paid',
    shipping_fee: 0,
    shipping_status: 'pending',
    subtotal: 470000,
    tax_amount: 0,
    total: 470000,
    ...rest,
  };
}

describe('useOrdersListController', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('maps order rows into order list items on successful fetch', async () => {
    setSupabaseRows(
      [
        {
          created_at: '2026-05-01T12:00:00.000Z',
          discount_amount: 0,
          id: 'order-1',
          order_items: [
            {
              id: 'item-1',
              name: 'iPhone 11 Pro Max',
              price: 470000,
              quantity: 1,
            },
          ],
          order_number: 'ORD-001',
          payment_status: 'paid',
          shipping_fee: 0,
          shipping_status: 'delivered',
          subtotal: 470000,
          tax_amount: 0,
          total: 470000,
        },
      ],
      null
    );

    const { result } = renderHook(() =>
      useOrdersListController({
        customerId: 'customer-1',
        onReconnect: () => () => undefined,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.orders).toHaveLength(1);
    });

    expect(result.current.orders[0]?.items_count).toBe(1);
    expect(result.current.orders[0]?.items[0]?.product_name).toBe(
      'iPhone 11 Pro Max'
    );
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error when Supabase fetch fails', async () => {
    setSupabaseRows([], { message: 'database unavailable' });

    const { result } = renderHook(() =>
      useOrdersListController({
        customerId: 'customer-1',
        onReconnect: () => () => undefined,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Failed to load orders');
    });
  });

  it('updates filtered orders when search text and status filters change', async () => {
    setSupabaseRows(
      [
        createMockOrderRow(
          {
            id: 'order-1',
            order_number: 'ORD-001',
            shipping_status: 'delivered',
          },
          'iPhone 11 Pro Max'
        ),
        createMockOrderRow(
          {
            id: 'order-2',
            order_number: 'ORD-002',
            shipping_status: 'pending',
          },
          'Samsung Charger'
        ),
        createMockOrderRow(
          {
            id: 'order-3',
            order_number: 'ORD-003',
            shipping_status: 'cancelled',
          },
          'USB Cable'
        ),
      ],
      null
    );

    const { result } = renderHook(() =>
      useOrdersListController({
        customerId: 'customer-1',
        onReconnect: () => () => undefined,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.orders).toHaveLength(3);
    });

    expect(result.current.orderFilters).toEqual([
      { count: 3, key: 'all', label: 'All' },
      { count: 1, key: 'active', label: 'Active' },
      { count: 1, key: 'delivered', label: 'Delivered' },
      { count: 1, key: 'closed', label: 'Closed' },
    ]);

    act(() => {
      result.current.setSearchQuery('iphone');
    });

    expect(result.current.filteredOrders.map((order) => order.id)).toEqual([
      'order-1',
    ]);

    act(() => {
      result.current.setSearchQuery('');
      result.current.setSelectedFilter('closed');
    });

    expect(result.current.filteredOrders.map((order) => order.id)).toEqual([
      'order-3',
    ]);
  });

  it('refreshes orders and clears the refreshing state', async () => {
    setSupabaseRows(
      [
        createMockOrderRow(
          { id: 'order-1', order_number: 'ORD-001' },
          'iPhone'
        ),
      ],
      null
    );

    const { result } = renderHook(() =>
      useOrdersListController({
        customerId: 'customer-1',
        onReconnect: () => () => undefined,
      })
    );

    await waitFor(() => {
      expect(result.current.orders.map((order) => order.id)).toEqual([
        'order-1',
      ]);
    });

    setSupabaseRows(
      [
        createMockOrderRow(
          {
            id: 'order-2',
            order_number: 'ORD-002',
            shipping_status: 'delivered',
          },
          'Pixel 8'
        ),
      ],
      null
    );

    act(() => {
      result.current.handleRefresh();
    });

    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.orders.map((order) => order.id)).toEqual([
        'order-2',
      ]);
    });

    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});
