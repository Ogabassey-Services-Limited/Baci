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
  primaryVariant,
  secondaryVariant,
  variantProduct,
} from '@/lib/product-route/product-detail-screen.fixtures';
import {
  getLastMockProps,
  mockProductDetailsBody,
  mockUseEffectivePrice,
  mockUseLocalSearchParams,
  mockUseProduct,
  ProductDetailScreen,
  resetProductDetailScreenMocks,
} from '../../test-support/product/product-detail-screen.test-utils';

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
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
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
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
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
      // resolveDefaultVariantSelection ranks condition first
      // (used > open box > new), so the used variant is selected by default.
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: secondaryVariant.condition,
          selectedStorage: '128GB',
          canPurchase: true,
        })
      );
    });
  });

  it('keeps unlimited-stock variants purchasable even when only the display selection resolves', async () => {
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
  });
});
