import { describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
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

function setSupabaseRows(rows: MockOrderRow[], error: { message: string } | null) {
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

describe('useOrdersListController', () => {
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
});
