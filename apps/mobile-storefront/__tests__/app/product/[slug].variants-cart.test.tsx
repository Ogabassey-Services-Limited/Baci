import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import {
  primaryVariant,
  variantProduct,
} from '@/lib/product-route/product-detail-screen.fixtures';
import {
  getLastMockProps,
  mockCartStoreState,
  mockProductDetailsBody,
  mockStickyBottomActions,
  mockUseEffectivePrice,
  mockUseLocalSearchParams,
  mockUseProduct,
  ProductDetailScreen,
  resetProductDetailScreenMocks,
} from './product-detail-screen.test-utils';

describe('ProductDetailScreen variant cart behavior', () => {
  beforeAll(() => {
    expect(primaryVariant).toBeDefined();
  });

  beforeEach(() => {
    resetProductDetailScreenMocks();
  });

  it('adds unlimited-stock variants to cart when only the display selection resolves', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'samsung-galaxy-s24',
      condition: 'open_box',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...variantProduct,
        slug: 'samsung-galaxy-s24',
        manage_stock: false,
        variant_attributes: null,
        available_conditions: ['open_box', 'used'],
        variants: [
          {
            ...primaryVariant,
            id: 'variant-open-box-128',
            condition: 'open_box',
            price: 552000,
            stock_quantity: 0,
            attributes: {
              storage: '128GB',
            },
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: 552000,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });

    act(() => {
      getLastMockProps<{
        onAddToCart: (event?: {
          nativeEvent?: Record<string, unknown>;
        }) => void;
      }>(mockStickyBottomActions)?.onAddToCart({
        nativeEvent: {
          pageX: 180,
          pageY: 720,
        },
      });
    });

    expect(mockCartStoreState.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 552000,
        slug: 'samsung-galaxy-s24',
        storage: '128GB',
        variant_id: 'variant-open-box-128',
      })
    );
  });
});
