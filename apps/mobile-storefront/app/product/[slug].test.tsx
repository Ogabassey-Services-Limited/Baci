import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { Product } from '@/types/product';
import ProductDetailScreen from './[slug]';

const mockProductDetailsBody = jest.fn();
const mockRouterReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseProduct = jest.fn();
const mockUseEffectivePrice = jest.fn();
const mockUseReviews = jest.fn();
const mockUseCartStore = jest.fn();
const mockUseSavedStore = jest.fn();
const mockStickyBottomActions = jest.fn();
const mockInsets = { top: 59, bottom: 34, left: 0, right: 0 };

const mockCartStoreState = {
  items: [],
  addItem: jest.fn(),
  updateQuantity: jest.fn(),
  removeItem: jest.fn(),
};

const mockSavedStoreState = {
  toggleSaved: jest.fn(),
  isSaved: jest.fn(() => false),
  toastState: { show: false, type: 'add', message: '' },
  dismissToast: jest.fn(),
};

const baseProduct: Product = {
  id: 'product-1',
  merchant_id: 'merchant-1',
  name: 'iPhone 13 Pro',
  slug: 'iphone-13-pro',
  price: 552000,
  image: 'https://cdn.example.com/iphone-13-pro.jpg',
  images: ['https://cdn.example.com/iphone-13-pro.jpg'],
};

const variantProduct: Product = {
  ...baseProduct,
  has_variants: true,
  variant_attributes: {
    storage: ['128GB'],
    connectivity: ['WiFi'],
  },
  variants: [
    {
      id: 'variant-new-128',
      name: '128GB WiFi',
      condition: 'new',
      price: 552000,
      stock_quantity: 5,
      attributes: {
        storage: '128GB',
        connectivity: 'WiFi',
      },
    },
    {
      id: 'variant-used-128',
      name: '128GB WiFi Used',
      condition: 'used',
      price: 500000,
      stock_quantity: 3,
      attributes: {
        storage: '128GB',
        connectivity: 'WiFi',
      },
    },
  ],
};

const [primaryVariant, secondaryVariant] = variantProduct.variants ?? [];

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    back: jest.fn(),
    push: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: (...args: unknown[]) =>
    mockUseLocalSearchParams(...args),
}));

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    __esModule: true,
    default: {
      View,
      ScrollView,
      createAnimatedComponent: (component: unknown) => component,
    },
    Extrapolate: { CLAMP: 'clamp' },
    FadeIn: { duration: () => ({}) },
    interpolate: () => 0,
    useAnimatedScrollHandler: () => jest.fn(),
    useAnimatedStyle: () => ({}),
    useSharedValue: () => ({ value: 0 }),
    withTiming: (value: unknown) => value,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('@/components/OfflineNotice', () => ({
  OfflineEmptyState: () => null,
}));

jest.mock('@/components/product/FlyToCartParticle', () => ({
  FlyToCartParticle: () => null,
}));

jest.mock('@/components/product/NegotiationModal', () => ({
  NegotiationModal: () => null,
}));

jest.mock('@/components/product/ProductDetailsBody', () => ({
  ProductDetailsBody: (props: unknown) => {
    mockProductDetailsBody(props);
    return null;
  },
}));

jest.mock('@/components/product/ProductImageGallery', () => ({
  ProductImageGallery: () => null,
}));

jest.mock('@/components/product/StickyBottomActions', () => ({
  StickyBottomActions: (props: unknown) => {
    mockStickyBottomActions(props);
    return null;
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks', () => ({
  useProduct: (...args: unknown[]) => mockUseProduct(...args),
}));

jest.mock('@/hooks/use-effective-price', () => ({
  useEffectivePrice: (...args: unknown[]) => mockUseEffectivePrice(...args),
}));

jest.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({
    success: jest.fn(),
    light: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-network-state', () => ({
  useNetworkState: () => ({ isOnline: true }),
}));

jest.mock('@/hooks/use-reviews', () => ({
  markReviewHelpful: jest.fn(),
  useReviews: (...args: unknown[]) => mockUseReviews(...args),
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (...args: unknown[]) => mockUseCartStore(...args),
}));

jest.mock('@/stores/saved-store', () => ({
  useSavedStore: (...args: unknown[]) => mockUseSavedStore(...args),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: unknown) => selector,
}));

describe('ProductDetailScreen canonical slug redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStickyBottomActions.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ slug: 'legacy-iphone-13-pro' });
    mockUseProduct.mockReturnValue({
      product: baseProduct,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: baseProduct.price,
      comparePrice: undefined,
    });
    mockUseReviews.mockReturnValue({
      reviews: [],
      stats: null,
      isLoading: false,
      hasMore: false,
      loadMore: jest.fn(),
    });
    mockUseCartStore.mockImplementation((selector: unknown) =>
      (selector as (state: typeof mockCartStoreState) => unknown)(
        mockCartStoreState
      )
    );
    mockUseSavedStore.mockImplementation((selector: unknown) =>
      (selector as (state: typeof mockSavedStoreState) => unknown)(
        mockSavedStoreState
      )
    );
  });

  it('redirects to the canonical product slug when the fetched slug differs', async () => {
    mockUseProduct.mockReturnValue({
      product: {
        ...baseProduct,
        slug: 'iphone-13-pro',
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/product/iphone-13-pro');
    });
  });

  it('does not redirect when the route slug is already canonical', async () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'iphone-13-pro' });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });

  it('does not redirect when product data is unavailable', async () => {
    mockUseProduct.mockReturnValue({
      product: null,
      isLoading: false,
      error: 'Not found',
      refetch: jest.fn(),
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });

  it('resets attribute-only variant params back to the bare product route', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
      storage: '128GB',
      utm_source: 'google',
    });
    mockUseProduct.mockReturnValue({
      product: variantProduct,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: variantProduct.price,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/product/iphone-13-pro');
    });
  });

  it('ignores unrelated route params when deciding whether to reset selection', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
      utm_source: 'google',
    });
    mockUseProduct.mockReturnValue({
      product: variantProduct,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: variantProduct.price,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });

  it('preselects the first advertised storage option when no default variant can be resolved', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'galaxy-tab-a11-plus-5g',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...baseProduct,
        id: 'product-variant-parent',
        name: 'Samsung Galaxy Tab A11+ 5G',
        slug: 'galaxy-tab-a11-plus-5g',
        has_variants: true,
        variant_attributes: {
          storage: ['128GB', '256GB'],
        },
        variants: [],
        color_images: {
          Gray: ['https://cdn.example.com/galaxy-tab-a11-plus-gray.jpg'],
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockProductDetailsBody).toHaveBeenCalled();
    });

    const lastCall =
      mockProductDetailsBody.mock.calls[
        mockProductDetailsBody.mock.calls.length - 1
      ];
    expect(lastCall?.[0]).toMatchObject({
      selectedColor: 'Gray',
      selectedStorage: '128GB',
    });
  });

  it('re-syncs selection when variant rows arrive later for the same product id', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'samsung-galaxy-s26-ultra',
    });

    let currentProduct: Product | null = {
      ...baseProduct,
      id: 'product-s26-ultra',
      name: 'Samsung Galaxy S26 Ultra',
      slug: 'samsung-galaxy-s26-ultra',
      has_variants: true,
      variant_attributes: {
        storage: ['256GB', '512GB', '1TB'],
      },
      variants: [],
      color_images: {
        Black: ['https://cdn.example.com/s26-ultra-black.jpg'],
      },
    };

    mockUseProduct.mockImplementation(() => ({
      product: currentProduct,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    }));

    const view = render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockProductDetailsBody).toHaveBeenCalled();
    });

    const lastCall =
      mockProductDetailsBody.mock.calls[
        mockProductDetailsBody.mock.calls.length - 1
      ];
    expect(lastCall?.[0]).toMatchObject({
      selectedColor: 'Black',
      selectedStorage: '256GB',
    });

    currentProduct = {
      ...currentProduct,
      variants: [
        {
          id: 'variant-256gb',
          name: '256GB',
          price: 1656000,
          stock_quantity: 5,
          attributes: { ram: '12GB', storage: '256GB' },
        },
        {
          id: 'variant-512gb',
          name: '512GB',
          price: 1892000,
          stock_quantity: 5,
          attributes: { ram: '12GB', storage: '512GB' },
        },
      ],
    };

    view.rerender(<ProductDetailScreen />);

    await waitFor(() => {
      const latestCall =
        mockProductDetailsBody.mock.calls[
          mockProductDetailsBody.mock.calls.length - 1
        ];
      expect(latestCall?.[0]).toMatchObject({
        selectedColor: 'Black',
        selectedStorage: '256GB',
        selectedVariant: 'variant-256gb',
      });
    });
  });

  it('keeps the product screen inside safe-area bounds and forwards the bottom inset to the sticky cart bar', async () => {
    const view = render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockStickyBottomActions).toHaveBeenCalledWith(
        expect.objectContaining({
          paddingBottom: 34,
        })
      );
    });

    const containerStyle = StyleSheet.flatten(view.toJSON()?.props.style);

    expect(containerStyle?.marginTop).toBeUndefined();
    expect(containerStyle?.marginBottom).toBeUndefined();
  });

  it('blocks purchase when the selected legacy condition offer is out of stock', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
      condition: 'used',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...baseProduct,
        has_condition_offers: true,
        stock_quantity: 10,
        offers: [
          {
            id: 'offer-used',
            condition: 'used',
            price: 500000,
            stock_quantity: 0,
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: 500000,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockProductDetailsBody).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedCondition: 'used',
        })
      );
      expect(mockStickyBottomActions).toHaveBeenCalledWith(
        expect.objectContaining({
          canPurchase: false,
        })
      );
    });
  });

  it('matches legacy offer condition aliases when computing canPurchase', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
      condition: 'open_box',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...baseProduct,
        has_condition_offers: true,
        stock_quantity: 0,
        offers: [
          {
            id: 'offer-refurbished',
            condition: 'refurbished',
            price: 510000,
            stock_quantity: 2,
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: 510000,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockProductDetailsBody).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedCondition: 'open_box',
        })
      );
      expect(mockStickyBottomActions).toHaveBeenCalledWith(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });
  });

  it('keeps alias-derived selectedCondition purchasable for legacy offer rows', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...baseProduct,
        has_condition_offers: true,
        stock_quantity: 0,
        offers: [
          {
            id: 'offer-refurbished',
            condition: 'refurbished',
            price: 510000,
            stock_quantity: 2,
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: 510000,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockProductDetailsBody).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedCondition: 'refurbished',
        })
      );
      expect(mockStickyBottomActions).toHaveBeenCalledWith(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });
  });

  it('keeps raw legacy offer conditions purchasable even when they are not canonical', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...baseProduct,
        has_condition_offers: true,
        stock_quantity: 0,
        offers: [
          {
            id: 'offer-scratch-and-dent',
            condition: 'scratch_and_dent',
            price: 470000,
            stock_quantity: 2,
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: 470000,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockProductDetailsBody).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedCondition: 'scratch_and_dent',
        })
      );
      expect(mockStickyBottomActions).toHaveBeenCalledWith(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });
  });

  it('prefers the exact selected condition offer over a canonical alias row for stock gating', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
      condition: 'open_box',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...baseProduct,
        has_condition_offers: true,
        stock_quantity: 0,
        offers: [
          {
            id: 'offer-refurbished',
            condition: 'refurbished',
            price: 510000,
            stock_quantity: 0,
          },
          {
            id: 'offer-open-box',
            condition: 'open_box',
            price: 520000,
            stock_quantity: 2,
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: 520000,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockProductDetailsBody).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedCondition: 'open_box',
        })
      );
      expect(mockStickyBottomActions).toHaveBeenCalledWith(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });
  });

  it('blocks purchase when the selected variant is out of stock', async () => {
    expect(primaryVariant).toBeDefined();
    expect(secondaryVariant).toBeDefined();

    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
      condition: 'used',
      connectivity: 'WiFi',
      storage: '128GB',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...variantProduct,
        variants: [
          primaryVariant,
          {
            ...secondaryVariant,
            stock_quantity: 0,
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: 500000,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockStickyBottomActions).toHaveBeenCalledWith(
        expect.objectContaining({
          canPurchase: false,
        })
      );
    });
  });

  it('keeps the selected variant purchasable when stock quantity is unknown but in_stock is true', async () => {
    expect(primaryVariant).toBeDefined();
    expect(secondaryVariant).toBeDefined();

    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
      condition: 'used',
      connectivity: 'WiFi',
      storage: '128GB',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...variantProduct,
        variants: [
          primaryVariant,
          {
            ...secondaryVariant,
            in_stock: true,
            stock_quantity: undefined,
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: 500000,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(mockStickyBottomActions).toHaveBeenCalledWith(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });
  });
});
