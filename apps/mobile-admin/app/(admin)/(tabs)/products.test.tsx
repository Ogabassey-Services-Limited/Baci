import { act, fireEvent, render, screen } from '@testing-library/react';
import { router } from 'expo-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductsScreen from './products';

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

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { payout_currency: 'NGN' } }),
}));
const productHookMocks = vi.hoisted(() => ({
  useProducts: vi.fn(),
}));

vi.mock('@/hooks/useProducts', () => ({
  useProducts: productHookMocks.useProducts,
  useCategories: () => ({ data: [], isLoading: false }),
  useInventoryStats: () => ({
    data: {
      activeCount: 0,
      inventoryCost: 0,
      inventoryValue: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      totalProducts: 0,
      totalStock: 0,
    },
    isLoading: false,
  }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useTopSellingProducts', () => ({
  useTopSellingProducts: () => ({ products: [], isLoading: false }),
}));
vi.mock('@/hooks/useWebsiteAnalytics', () => ({
  useWebsiteAnalytics: () => ({ data: null, isLoading: false }),
}));
vi.mock('expo-router', () => ({
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock('react-native-reanimated', async () => {
  const React = await import('react');
  return {
    default: {
      View: ({
        children,
        style,
        testID,
        ...props
      }: {
        children?: React.ReactNode;
        style?: unknown;
        testID?: string;
        [key: string]: unknown;
      }) =>
        React.createElement(
          'div',
          {
            'data-style': JSON.stringify(style),
            'data-testid': testID,
            ...props,
          },
          children
        ),
    },
    useSharedValue: vi.fn(() => ({ value: 0 })),
    useAnimatedStyle: vi.fn(() => ({})),
    withSpring: vi.fn((val) => val),
    withTiming: vi.fn((val) => val),
  };
});
vi.mock('@/components/ui/KeyboardAwareModalContainer', async () => {
  const React = await import('react');
  return {
    KeyboardAwareModalContainer: ({
      children,
    }: {
      children: React.ReactNode;
    }) => React.createElement('div', null, children),
  };
});
vi.mock('@/components/ui/SafeImage', async () => {
  const React = await import('react');
  return {
    default: () => React.createElement('div', null),
  };
});

describe('ProductsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productHookMocks.useProducts.mockImplementation(
      (filters?: { search?: string }) => ({
        data: {
          pages: [
            {
              products:
                filters?.search === 'iphone'
                  ? [
                      {
                        id: 'product-1',
                        images: [],
                        manage_stock: true,
                        name: 'iPhone 15 Pro',
                        price: 1000,
                        stock: 8,
                        stock_quantity: 8,
                      },
                    ]
                  : [],
              totalCount: filters?.search === 'iphone' ? 1 : 0,
            },
          ],
        },
        error: null,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: vi.fn(),
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders products screen successfully', () => {
    const { getByRole, getAllByText } = render(<ProductsScreen />);

    // Assert that the screen renders the basic UI elements
    expect(getByRole('button', { name: 'Add new product' })).toBeTruthy();
    expect(getAllByText('In Stock (0)')[0]).toBeTruthy();
    expect(getAllByText('Items (0)')[0]).toBeTruthy();
    expect(getAllByText('Out of Stock')[0]).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Out of Stock (0)' })).toBeNull();
    expect(getByRole('button', { name: 'Scan barcode' })).toBeTruthy();
    expect(getAllByText('Start managing stock')[0]).toBeTruthy();
    expect(getAllByText('Add Stocked Item')[0]).toBeTruthy();
  });

  it('opens the barcode scanner from the products search row', () => {
    render(<ProductsScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Scan barcode' }));

    expect(router.push).toHaveBeenCalledWith('/scan');
  });

  it('requests low-stock products from the products tab', () => {
    render(<ProductsScreen />);

    fireEvent.click(screen.getByRole('tab', { name: 'Low Stock (0)' }));

    expect(productHookMocks.useProducts).toHaveBeenLastCalledWith({
      search: undefined,
      stockFilter: 'low_stock',
    });
  });

  it('shows a product load error state when the product query fails', () => {
    productHookMocks.useProducts.mockReturnValue({
      data: { pages: [{ products: [], totalCount: 0 }] },
      error: new Error('products unavailable'),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    const { getByText } = render(<ProductsScreen />);

    expect(getByText("Couldn't load products")).toBeTruthy();
    expect(
      getByText('Refresh the page or try again in a moment.')
    ).toBeTruthy();
  });

  it('waits for the debounced product search value before rendering search results', () => {
    vi.useFakeTimers();
    const { getByLabelText } = render(<ProductsScreen />);

    fireEvent.change(getByLabelText('Search products'), {
      target: { value: 'iphone' },
    });

    expect(screen.queryByText('iPhone 15 Pro')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText('iPhone 15 Pro')).toBeTruthy();
  });
});
