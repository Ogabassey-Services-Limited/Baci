/**
 * Regression tests for SavedItemsScreen
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, View, type ViewProps } from 'react-native';
import SavedItemsScreen from '@/app/saved/index';
import { SPACING } from '@/constants/Colors';

const FIXED_SAVED_AT = 1_670_000_000_000;
const mockReactActual = jest.requireActual('react') as typeof import('react');
const mockReactNativeActual = jest.requireActual(
  'react-native'
) as typeof import('react-native');

interface MockFlashListProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

type MockListStyleOptions = {
  gap?: number;
  includeBottomInset?: boolean;
  padding?: number;
  paddingBottom?: number;
};

type MockSavedItem = {
  id: string;
  image: string;
  name: string;
  price: number;
  product_id: string;
  slug: string;
  savedAt: number;
};

interface MockShellProps extends React.PropsWithChildren<ViewProps> {
  edges?: readonly string[];
}

const mockFlashList = jest.fn(({ children, ...props }: MockFlashListProps) => (
  <View testID="saved-flash-list" {...props}>
    {children}
  </View>
));
const mockStorefrontScreenShell = jest.fn(
  ({ children, ...props }: MockShellProps) => (
    <View testID="storefront-screen-shell" {...props}>
      {children}
    </View>
  )
);
const mockGetListContentStyle =
  jest.fn<
    (options?: MockListStyleOptions) => {
      gap: number;
      padding: number;
      paddingBottom: number;
    }
  >();
const mockUseStorefrontInsets = jest.fn();
const mockSavedItems = jest.fn<() => MockSavedItem[]>();
const mockRemoveItem = jest.fn();
const mockClearSaved = jest.fn();
const mockAddToCart = jest.fn();
const mockRouterPush = jest.fn();
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data = [],
    renderItem,
    ListEmptyComponent,
    children,
    ...props
  }: {
    data?: MockSavedItem[];
    children?: React.ReactNode;
    renderItem?: (info: {
      item: MockSavedItem;
      index: number;
    }) => React.ReactNode;
    ListEmptyComponent?: React.ReactNode | (() => React.ReactNode);
  }) => {
    const renderedContent =
      data.length === 0
        ? typeof ListEmptyComponent === 'function'
          ? ListEmptyComponent()
          : ListEmptyComponent
        : data.map((item, index) =>
            mockReactActual.createElement(
              mockReactNativeActual.View,
              { key: item.id },
              renderItem ? renderItem({ item, index }) : null
            )
          );

    return mockFlashList({
      children: renderedContent ?? children,
      ...props,
      data,
      renderItem,
      ListEmptyComponent,
    });
  },
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

jest.mock('@/stores/saved-store', () => ({
  useSavedStore: (
    selector: (state: {
      items: Array<{
        id: string;
        image: string;
        name: string;
        price: number;
        product_id: string;
        slug: string;
        savedAt: number;
      }>;
      removeItem: (productId: string) => void;
      clearSaved: () => void;
    }) => unknown
  ) =>
    selector({
      items: mockSavedItems(),
      removeItem: mockRemoveItem,
      clearSaved: mockClearSaved,
    }),
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (
    selector: (state: { addItem: (item: unknown) => void }) => unknown
  ) =>
    selector({
      addItem: mockAddToCart,
    }),
}));

jest.mock('@/components/saved/SavedItemCard', () => ({
  SavedItemCard: ({
    item,
    onPress,
  }: {
    item: { name: string };
    onPress: (item: { name: string }) => void;
  }) => {
    return mockReactActual.createElement(
      mockReactNativeActual.Pressable,
      {
        accessibilityRole: 'button',
        accessibilityLabel: `View ${item.name}`,
        onPress: () => onPress(item),
      },
      mockReactActual.createElement(mockReactNativeActual.Text, null, item.name)
    );
  },
}));

describe('SavedItemsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
    mockGetListContentStyle.mockImplementation(
      (options?: MockListStyleOptions) => ({
        gap: options?.gap ?? 12,
        padding: options?.padding ?? 16,
        paddingBottom:
          (options?.paddingBottom ?? options?.padding ?? 16) +
          (options?.includeBottomInset === false ? 0 : 34),
      })
    );
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: jest.fn(),
      getListContentStyle: mockGetListContentStyle,
    });
  });

  it('uses the storefront shell and list padding helper for the populated saved-items view', () => {
    mockSavedItems.mockReturnValue([
      {
        id: 'saved-1',
        image: 'https://example.com/image.png',
        name: 'Test Product',
        price: 2500,
        product_id: 'product-1',
        slug: 'test-product',
        savedAt: FIXED_SAVED_AT,
      },
    ]);

    render(<SavedItemsScreen />);

    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];

    expect(shellProps?.edges).toEqual(['bottom']);
    expect(mockGetListContentStyle).toHaveBeenCalledWith({
      gap: SPACING.md,
      includeBottomInset: false,
      padding: SPACING.md,
      paddingBottom: SPACING.lg,
    });

    fireEvent.press(screen.getByLabelText('View Test Product'));

    expect(mockRouterPush).toHaveBeenCalledWith('/product/test-product');
  });

  it('renders the empty state inside the storefront shell', () => {
    mockSavedItems.mockReturnValue([]);

    render(<SavedItemsScreen />);

    expect(screen.getByText('No saved items')).toBeOnTheScreen();
    expect(screen.getByLabelText('Browse products')).toBeOnTheScreen();
  });

  it('shows an unavailable alert instead of navigating when a saved item has no slug', () => {
    mockSavedItems.mockReturnValue([
      {
        id: 'saved-1',
        image: 'https://example.com/image.png',
        name: 'Legacy Product',
        price: 2500,
        product_id: 'product-1',
        slug: '',
        savedAt: FIXED_SAVED_AT,
      },
    ]);

    render(<SavedItemsScreen />);

    fireEvent.press(screen.getByLabelText('View Legacy Product'));

    expect(mockAlert).toHaveBeenCalledWith(
      'Product Unavailable',
      'This saved item is no longer available.'
    );
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
