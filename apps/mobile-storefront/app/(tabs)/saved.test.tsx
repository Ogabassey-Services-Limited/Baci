import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import type { SavedItem } from '@/stores/saved-store';
import SavedTabScreen from './saved';

interface MockFlashListProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

const mockFlashList = jest.fn(({ children, ...props }: MockFlashListProps) => (
  <View testID="saved-flash-list" {...props}>
    {children}
  </View>
));
const mockStorefrontScreenShell = jest.fn(({ children, ...props }) => (
  <View testID="storefront-screen-shell" {...props}>
    {children}
  </View>
));
const mockUseStorefrontInsets = jest.fn();
const mockUseNetworkState = jest.fn();
const mockSavedStore = jest.fn<() => SavedItem[]>();
const mockRemoveItem = jest.fn();
const mockRefresh = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data = [],
    renderItem,
    children,
    ...props
  }: {
    data?: SavedItem[];
    children?: React.ReactNode;
    renderItem?: (info: { item: SavedItem; index: number }) => React.ReactNode;
  }) => {
    const React = jest.requireActual('react') as typeof import('react');
    const { View } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');

    const renderedChildren = data.length
      ? data.map((item, index) =>
          React.createElement(
            View,
            { key: item.id },
            renderItem ? renderItem({ item, index }) : null
          )
        )
      : children;

    return mockFlashList({
      children: renderedChildren,
      ...props,
      data,
      renderItem,
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

jest.mock('@/hooks/use-network-state', () => ({
  useNetworkState: () => mockUseNetworkState(),
}));

jest.mock('@/stores/saved-store', () => ({
  useSavedStore: (
    selector: (state: {
      items: SavedItem[];
      removeItem: (productId: string) => void;
    }) => unknown
  ) =>
    selector({
      items: mockSavedStore(),
      removeItem: mockRemoveItem,
    }),
}));

describe('SavedTabScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: jest.fn(),
      getListContentStyle: () => ({
        padding: 16,
        paddingBottom: 100,
        gap: 12,
      }),
    });
    mockUseNetworkState.mockReturnValue({
      isOnline: true,
      refresh: mockRefresh,
    });
  });

  it('uses the storefront shell and list padding helper for the populated saved-items view', () => {
    mockSavedStore.mockReturnValue([
      {
        id: 'saved-1',
        image: 'https://example.com/image.png',
        name: 'Test Product',
        price: 2500,
        product_id: 'product-1',
        slug: 'test-product',
        savedAt: Date.now(),
      },
    ]);

    render(<SavedTabScreen />);
    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];
    const flashListProps = mockFlashList.mock.calls[0]?.[0];

    expect(shellProps?.edges).toEqual(['top']);
    expect(flashListProps?.contentContainerStyle).toEqual({
      padding: 16,
      paddingBottom: 100,
      gap: 12,
    });
  });

  it('keeps the empty-state branch inside the storefront shell', () => {
    mockSavedStore.mockReturnValue([]);

    render(<SavedTabScreen />);

    expect(mockStorefrontScreenShell).toHaveBeenCalled();
    expect(screen.getByText('No saved items yet')).toBeTruthy();
  });

  it('disables browsing and shows offline recovery copy in the empty state', () => {
    mockSavedStore.mockReturnValue([]);
    mockUseNetworkState.mockReturnValue({
      isOnline: false,
      refresh: mockRefresh,
    });

    render(<SavedTabScreen />);

    const browseButton = screen.getByLabelText('Browse products');

    expect(
      screen.getByText("You're offline. Your saved items are stored locally.")
    ).toBeTruthy();
    expect(screen.getByText('Connect to browse products')).toBeTruthy();
    expect(browseButton.props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByLabelText('Retry connection'));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('navigates to the saved product when the item is pressed', () => {
    mockSavedStore.mockReturnValue([
      {
        id: 'saved-1',
        image: 'https://example.com/image.png',
        name: 'Test Product',
        price: 2500,
        product_id: 'product-1',
        slug: 'test-product',
        savedAt: Date.now(),
      },
    ]);

    render(<SavedTabScreen />);

    fireEvent.press(screen.getByLabelText('View Test Product'));

    expect(mockRouterPush).toHaveBeenCalledWith('/product/test-product');
  });

  it('skips navigation when a saved item is missing its slug', () => {
    mockSavedStore.mockReturnValue([
      {
        id: 'saved-1',
        image: 'https://example.com/image.png',
        name: 'Broken Product',
        price: 2500,
        product_id: 'product-1',
        slug: '',
        savedAt: Date.now(),
      },
    ]);

    render(<SavedTabScreen />);

    fireEvent.press(screen.getByLabelText('View Broken Product'));

    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('removes a saved item when the remove action is pressed', () => {
    mockSavedStore.mockReturnValue([
      {
        id: 'saved-1',
        image: 'https://example.com/image.png',
        name: 'Test Product',
        price: 2500,
        product_id: 'product-1',
        slug: 'test-product',
        savedAt: Date.now(),
      },
    ]);

    render(<SavedTabScreen />);

    fireEvent.press(
      screen.getByLabelText('Remove Test Product from saved items')
    );

    expect(mockRemoveItem).toHaveBeenCalledWith('product-1');
  });

  it('shows the offline banner and per-item hint when saved items are viewed offline', () => {
    mockSavedStore.mockReturnValue([
      {
        id: 'saved-1',
        image: 'https://example.com/image.png',
        name: 'Test Product',
        price: 2500,
        product_id: 'product-1',
        slug: 'test-product',
        savedAt: Date.now(),
      },
    ]);
    mockUseNetworkState.mockReturnValue({
      isOnline: false,
      refresh: mockRefresh,
    });

    render(<SavedTabScreen />);

    expect(
      screen.getByText("You're offline. Viewing locally saved items.")
    ).toBeTruthy();
    expect(screen.getByText('Tap to view when online')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry connection'));
    expect(mockRefresh).toHaveBeenCalled();
  });
});
