import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  useInventoryStats: () => ({ data: null, isLoading: false }),
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

  it('renders products screen successfully', () => {
    const { getByRole, getAllByText } = render(<ProductsScreen />);

    // Assert that the screen renders the basic UI elements
    expect(getByRole('button', { name: 'Add new product' })).toBeTruthy();
    expect(getAllByText('In Stock (0)')[0]).toBeTruthy();
    expect(getAllByText('Items (0)')[0]).toBeTruthy();
    expect(getAllByText('Start managing stock')[0]).toBeTruthy();
    expect(getAllByText('Add Stocked Item')[0]).toBeTruthy();
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
});
