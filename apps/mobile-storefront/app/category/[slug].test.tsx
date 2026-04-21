import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';
import CategoryScreen from './[slug]';

const mockFlashList = jest.fn(({ children, ...props }) => (
  <View testID="category-flash-list" {...props}>
    {children}
  </View>
));
const mockStorefrontScreenShell = jest.fn(({ children, ...props }) => (
  <View testID="storefront-screen-shell" {...props}>
    {children}
  </View>
));
const mockUseStorefrontInsets = jest.fn();
const mockUseCategories = jest.fn();
const mockUseProducts = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({ children, ...props }: { children?: React.ReactNode }) =>
    mockFlashList({ children, ...props }),
}));

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
  }) => mockStorefrontScreenShell({ children, ...props }),
}));

jest.mock('@/hooks/use-storefront-insets', () => ({
  useStorefrontInsets: () => mockUseStorefrontInsets(),
}));

jest.mock('@/hooks', () => ({
  useCategories: () => mockUseCategories(),
  useProducts: () => mockUseProducts(),
}));

jest.mock('@/components/storefront/ProductCard', () => ({
  ProductCard: () => {
    const React = jest.requireActual('react') as typeof import('react');
    const { View } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');

    return React.createElement(View, { testID: 'product-card' });
  },
}));

describe('CategoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'accessories',
    });
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: jest.fn(),
      getListContentStyle: () => ({
        paddingTop: 16,
        paddingBottom: 24,
      }),
    });
    mockUseCategories.mockReturnValue({
      data: [
        {
          id: 'category-1',
          slug: 'accessories',
        },
      ],
      isLoading: false,
    });
    mockUseProducts.mockReturnValue({
      products: [
        {
          id: 'product-1',
          slug: 'test-product',
        },
      ],
      isLoading: false,
      error: null,
      hasMore: false,
      refetch: jest.fn(),
      loadMore: jest.fn(),
    });
  });

  it('uses the storefront shell and list padding helper for category browsing', () => {
    render(<CategoryScreen />);
    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];
    const flashListProps = mockFlashList.mock.calls[0]?.[0];

    expect(shellProps?.edges).toEqual(['bottom']);
    expect(flashListProps?.contentContainerStyle).toEqual({
      paddingTop: 16,
      paddingBottom: 24,
    });
  });
});
