import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/stores/cart-store';
import { useCart } from './use-cart';

const mockNetInfoFetch = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  fetch: () => mockNetInfoFetch(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../lib/storage', () => ({
  syncStorage: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

describe('useCart stock validation', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], isLoading: false, lineSequence: 0 });
    jest.clearAllMocks();
    mockNetInfoFetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  it('blocks add-to-cart when split voucher lines already consume available stock', async () => {
    const single = jest
      .fn()
      .mockResolvedValue({ data: { manage_stock: true, stock_quantity: 2 } });
    const eq = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq }));
    const productQuery = { select } as unknown as ReturnType<typeof supabase.from>;
    jest.mocked(supabase.from).mockReturnValue(productQuery);

    const firstVoucher = {
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 0,
      quantity: 1,
      voucher_award_id: 'voucher-award-1',
    };
    useCartStore.getState().addItem(firstVoucher);
    useCartStore.getState().addItem({
      ...firstVoucher,
      voucher_award_id: 'voucher-award-2',
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { gcTime: Infinity, retry: false },
        queries: { gcTime: Infinity, retry: false },
      },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useCart(), { wrapper });

    try {
      act(() => {
        result.current.addToCart({
          product_id: 'product-1',
          slug: 'redmi-note-14',
          variant_id: 'variant-128',
          name: 'Redmi Note 14',
          price: 220000,
          quantity: 1,
        });
      });

      await waitFor(() => {
        expect(single).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(useCartStore.getState().items).toHaveLength(2);
      });
      await waitFor(() => {
        expect(result.current.isAddingToCart).toBe(false);
      });
      expect(useCartStore.getState().items).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({ price: 220000 }),
        ])
      );
    } finally {
      unmount();
      queryClient.clear();
    }
  });
});
