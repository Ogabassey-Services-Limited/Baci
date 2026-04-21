import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import SavedTabScreen from './saved';

interface SavedItem {
  id: string;
  image: string;
  name: string;
  price: number;
  product_id: string;
  slug: string;
}

const mockFlashList = jest.fn(({ children, ...props }) => (
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
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
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
      removeItem: jest.fn(),
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
      refresh: jest.fn(),
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
});
