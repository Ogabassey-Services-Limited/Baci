import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';
import {
  mockProductDetailsBody,
  mockStickyBottomActions,
  mockUseEffectivePrice,
  mockUseLocalSearchParams,
  mockUseProduct,
  ProductDetailScreen,
  primaryVariant,
  resetProductDetailScreenMocks,
  secondaryVariant,
  variantProduct,
} from './product-detail-screen.test-utils';

function getLastMockProps<T>(mockFn: { mock: { calls: unknown[][] } }) {
  return mockFn.mock.calls.at(-1)?.[0] as T | undefined;
}

describe('ProductDetailScreen variant stock behavior', () => {
  beforeAll(() => {
    expect(primaryVariant).toBeDefined();
    expect(secondaryVariant).toBeDefined();
  });

  beforeEach(() => {
    resetProductDetailScreenMocks();
  });

  it('blocks purchase when the selected variant is out of stock', async () => {
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
      expect(getLastMockProps(mockStickyBottomActions)).toEqual(
        expect.objectContaining({
          canPurchase: false,
        })
      );
    });
  });

  it('keeps the selected variant purchasable when stock quantity is unknown but in_stock is true', async () => {
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
      expect(getLastMockProps(mockStickyBottomActions)).toEqual(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });
  });

  it('keeps unmanaged variant products purchasable and forwards the resolved storage selection', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...variantProduct,
        manage_stock: false,
        stock_quantity: 0,
        variants: [
          {
            ...primaryVariant,
            stock_quantity: 0,
          },
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
      price: variantProduct.price,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: 'new',
          selectedStorage: '128GB',
        })
      );
      expect(getLastMockProps(mockStickyBottomActions)).toEqual(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });
  });

  it('passes the effective selected condition into price resolution after selection settles', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
      condition: 'used',
      variantId: primaryVariant.id,
    });
    mockUseProduct.mockReturnValue({
      product: variantProduct,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: primaryVariant.price,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      const latestCall =
        mockUseEffectivePrice.mock.calls[
          mockUseEffectivePrice.mock.calls.length - 1
        ];
      expect(latestCall?.[2]).toBe('new');
    });
  });
});
