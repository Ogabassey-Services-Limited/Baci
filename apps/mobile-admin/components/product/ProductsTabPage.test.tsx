import { fireEvent, render, screen } from '@testing-library/react';
import { router } from 'expo-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsTabPage } from './ProductsTabPage';

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
  return { default: () => React.createElement('div', null) };
});
vi.mock('expo-router', () => ({
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock('react-native-reanimated', async () => {
  const React = await import('react');
  return {
    default: {
      createAnimatedComponent: (Component: unknown) => Component,
      View: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', null, children),
    },
    runOnJS: vi.fn((fn) => fn),
    useEvent: vi.fn(() => vi.fn()),
    useSharedValue: vi.fn(() => ({ value: 0 })),
    useAnimatedStyle: vi.fn(() => ({})),
    withSpring: vi.fn((val) => val),
    withTiming: vi.fn((val) => val),
  };
});
vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
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
  useCategories: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useInventoryStats: () => ({
    data: {
      activeCount: 2,
      inventoryCost: 0,
      inventoryValue: 0,
      lowStockCount: 1,
      outOfStockCount: 0,
      totalProducts: 9,
      totalStock: 0,
    },
    isLoading: false,
  }),
}));
vi.mock('@/hooks/useTopSellingProducts', () => ({
  useTopSellingProducts: () => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/useWebsiteAnalytics', () => ({
  useWebsiteAnalytics: () => ({ data: null, isLoading: false }),
}));
vi.mock('@/components/ui/SafeImage', async () => {
  const React = await import('react');
  return { default: () => React.createElement('div', null) };
});

function renderPage(variant: 'in_stock' | 'on_website') {
  const handlers = {
    onClearSearch: vi.fn(),
    onOpenCreateCategory: vi.fn(),
    onScroll: vi.fn(),
    onSubTabChange: vi.fn(),
  };
  render(
    <ProductsTabPage
      currencySymbol="₦"
      onClearSearch={handlers.onClearSearch}
      onOpenCreateCategory={handlers.onOpenCreateCategory}
      onScroll={handlers.onScroll}
      onSubTabChange={handlers.onSubTabChange}
      searchQuery=""
      variant={variant}
    />
  );
  return handlers;
}

describe('ProductsTabPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productHookMocks.useProducts.mockReturnValue({
      data: { pages: [{ products: [], totalCount: 0 }] },
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  it('requests in-stock products with counts from inventory stats', () => {
    renderPage('in_stock');

    expect(productHookMocks.useProducts).toHaveBeenLastCalledWith({
      search: undefined,
      stockFilter: 'in_stock',
    });
    expect(screen.getByRole('tab', { name: /Items \(2\)/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Low Stock (1)' })).toBeTruthy();
    expect(screen.getByText('Start managing stock')).toBeTruthy();
  });

  it('requests the full catalog on the website page with no stock sub-tabs', () => {
    renderPage('on_website');

    expect(productHookMocks.useProducts).toHaveBeenLastCalledWith({
      search: undefined,
      stockFilter: undefined,
    });
    expect(screen.getByRole('tab', { name: /Items \(9\)/ })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Low Stock/ })).toBeNull();
    expect(screen.getByText('No items on website')).toBeTruthy();
  });

  it('reports sub-tab changes and refetches with the new stock filter', () => {
    const handlers = renderPage('in_stock');

    fireEvent.click(screen.getByRole('tab', { name: 'Out of Stock (0)' }));

    expect(handlers.onSubTabChange).toHaveBeenCalledWith('out_of_stock');
    expect(productHookMocks.useProducts).toHaveBeenLastCalledWith({
      search: undefined,
      stockFilter: 'out_of_stock',
    });
  });

  it('opens category creation from the categories empty state', () => {
    const handlers = renderPage('in_stock');

    fireEvent.click(screen.getByRole('tab', { name: 'Categories (0)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Category' }));

    expect(handlers.onOpenCreateCategory).toHaveBeenCalledTimes(1);
  });

  it('navigates to product creation from the default empty state', () => {
    renderPage('in_stock');

    fireEvent.click(screen.getByRole('button', { name: 'Add Stocked Item' }));

    expect(router.push).toHaveBeenCalledWith('/product/new');
  });

  it('shows an error empty state when products fail to load', () => {
    const refetch = vi.fn();
    productHookMocks.useProducts.mockReturnValue({
      data: undefined,
      error: new Error('Network error'),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch,
    });

    renderPage('in_stock');

    expect(screen.getByText("Couldn't load products")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows a loading indicator while products are loading', () => {
    productHookMocks.useProducts.mockReturnValue({
      data: undefined,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      refetch: vi.fn(),
    });

    renderPage('in_stock');

    expect(screen.getByLabelText('Loading products')).toBeTruthy();
    expect(screen.queryByText('Start managing stock')).toBeNull();
  });
});
