import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { CartPriceChange } from '@/services/cart-reprice';
import type { CartItem } from '@/stores/cart-store.types';

const mockRepriceCartItems = jest.fn();
const mockRepriceItems = jest.fn();
let mockMerchant: { id: string } | null = { id: 'merchant-1' };
let mockItems: CartItem[] = [];

jest.mock('@/hooks/product-utils', () => ({
  CONSTANT_MERCHANT_ID: 'fallback-merchant',
}));

jest.mock('@/hooks/use-merchant', () => ({
  useMerchant: () => ({ data: mockMerchant }),
}));

jest.mock('@/services/cart-reprice', () => ({
  repriceCartItems: (
    items: CartItem[],
    merchantId: string
  ): Promise<{
    priceById: Record<string, number>;
    changes: CartPriceChange[];
  }> => mockRepriceCartItems(items, merchantId),
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: jest.fn(),
}));

const mockedUseCartStore = (
  jest.requireMock('@/stores/cart-store') as {
    useCartStore: jest.Mock & {
      getState?: () => { items: CartItem[] };
    };
  }
).useCartStore;

let useCartReprice: typeof import('./use-cart-reprice').useCartReprice;

beforeAll(async () => {
  ({ useCartReprice } = await import('./use-cart-reprice'));
});

function createItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'cart-1',
    product_id: 'product-1',
    slug: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    price: 1200000,
    quantity: 1,
    ...overrides,
  };
}

describe('useCartReprice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMerchant = { id: 'merchant-1' };
    mockItems = [createItem()];
    mockedUseCartStore.mockImplementation(
      (selector: (state: { repriceItems: typeof mockRepriceItems }) => unknown) =>
        selector({ repriceItems: mockRepriceItems })
    );
    mockedUseCartStore.getState = () => ({ items: mockItems });
  });

  it('reprices cart lines and exposes dismissible price changes', async () => {
    const changes: CartPriceChange[] = [
      {
        id: 'cart-1',
        name: 'iPhone 15 Pro',
        oldPrice: 1200000,
        newPrice: 1250000,
      },
    ];
    mockRepriceCartItems.mockResolvedValue({
      priceById: { 'cart-1': 1250000 },
      changes,
    });

    const { result } = renderHook(() => useCartReprice());

    await waitFor(() => {
      expect(mockRepriceCartItems).toHaveBeenCalledWith(
        mockItems,
        'merchant-1'
      );
      expect(mockRepriceItems).toHaveBeenCalledWith({ 'cart-1': 1250000 });
      expect(result.current.priceChanges).toEqual(changes);
    });

    act(() => {
      result.current.dismissPriceChanges();
    });

    expect(result.current.priceChanges).toEqual([]);
  });

  it('uses the fallback merchant id when merchant data has not loaded', async () => {
    mockMerchant = null;
    mockRepriceCartItems.mockResolvedValue({
      priceById: {},
      changes: [],
    });

    renderHook(() => useCartReprice());

    await waitFor(() => {
      expect(mockRepriceCartItems).toHaveBeenCalledWith(
        mockItems,
        'fallback-merchant'
      );
    });
  });

  it('skips repricing when the cart is empty', () => {
    mockItems = [];
    mockRepriceCartItems.mockResolvedValue({
      priceById: {},
      changes: [],
    });

    const { result } = renderHook(() => useCartReprice());

    expect(mockRepriceCartItems).not.toHaveBeenCalled();
    expect(mockRepriceItems).not.toHaveBeenCalled();
    expect(result.current.priceChanges).toEqual([]);
  });

  it('fails open without mutating cart state when repricing rejects', async () => {
    mockRepriceCartItems.mockRejectedValue(new Error('network unavailable'));

    const { result } = renderHook(() => useCartReprice());

    await waitFor(() => {
      expect(mockRepriceCartItems).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRepriceItems).not.toHaveBeenCalled();
    expect(result.current.priceChanges).toEqual([]);
  });
});
