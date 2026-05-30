import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/stores/cart-store';
import {
  checkStock,
  getTotalRequestedQuantityForStock,
} from './cart-stock';

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

describe('cart-stock helpers', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], isLoading: false, lineSequence: 0 });
    jest.clearAllMocks();
    mockNetInfoFetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  it('counts existing voucher lines plus the incoming paid quantity', () => {
    const voucherItem = {
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 0,
      quantity: 1,
      voucher_award_id: 'voucher-award-1',
    };

    useCartStore.getState().addItem(voucherItem);
    useCartStore.getState().addItem({
      ...voucherItem,
      voucher_award_id: 'voucher-award-2',
    });

    expect(
      getTotalRequestedQuantityForStock({
        product_id: 'product-1',
        slug: 'redmi-note-14',
        variant_id: 'variant-128',
        name: 'Redmi Note 14',
        price: 220000,
        quantity: 2,
      })
    ).toBe(4);
  });

  it('uses cached stock while offline', async () => {
    mockNetInfoFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    await expect(checkStock('product-1', 2, 3)).resolves.toEqual({
      available: true,
      currentStock: 3,
      requestedQuantity: 2,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('blocks offline stock checks when no cache is available', async () => {
    mockNetInfoFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    await expect(checkStock('product-1', 2)).rejects.toThrow(
      'Cannot verify stock while offline.'
    );
  });
});
