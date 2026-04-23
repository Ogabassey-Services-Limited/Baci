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
} from '../../../test-support/product/product-detail-screen.test-utils';

describe('ProductDetailScreen variant pricing behavior', () => {
  beforeAll(() => {
    expect(primaryVariant).toBeDefined();
    expect(secondaryVariant).toBeDefined();
  });

  beforeEach(() => {
    resetProductDetailScreenMocks();
  });

  it('resolves the selected storage variant so price updates when a shopper changes storage', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'samsung-galaxy-s24',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...variantProduct,
        slug: 'samsung-galaxy-s24',
        price: 600000,
        manage_stock: false,
        variant_attributes: null,
        available_conditions: ['open_box', 'used'],
        variants: [
          {
            ...primaryVariant,
            id: 'variant-open-box-128',
            condition: 'open_box',
            price: 600000,
            stock_quantity: 0,
            attributes: {
              storage: '128GB',
            },
          },
          {
            ...primaryVariant,
            id: 'variant-open-box-256',
            condition: 'open_box',
            price: 680000,
            stock_quantity: 0,
            attributes: {
              storage: '256GB',
            },
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockImplementation(
      (
        _product: unknown,
        resolvedSelection: unknown,
        _selectedCondition: unknown,
        _negotiatedPrice: unknown
      ) => {
        const sel = resolvedSelection as {
          price?: number;
          compareAtPrice?: number;
        } | null;
        return {
          price: sel?.price ?? 600000,
          comparePrice: sel?.compareAtPrice,
        };
      }
    );

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedStorage: '128GB',
        })
      );
    });

    act(() => {
      getLastMockProps<{
        onSelectStorage: (storage: string) => void;
      }>(mockProductDetailsBody)?.onSelectStorage('256GB');
    });

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedStorage: '256GB',
        })
      );

      const latestCall =
        mockUseEffectivePrice.mock.calls[
          mockUseEffectivePrice.mock.calls.length - 1
        ];

      expect(latestCall?.[1]).toEqual(
        expect.objectContaining({
          price: 680000,
          storage: '256GB',
          variant: expect.objectContaining({
            id: 'variant-open-box-256',
          }),
        })
      );
    });
  });

  it('ignores stale generic product colors when resolving storage-based variant pricing', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'samsung-galaxy-s24',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...variantProduct,
        slug: 'samsung-galaxy-s24',
        color: 'Blue',
        colors: ['Blue'],
        color_images: {
          Blue: ['https://cdn.example.com/s24-blue.jpg'],
        },
        price: 600000,
        manage_stock: false,
        variant_attributes: {
          color: ['Blue'],
          storage: ['128GB', '256GB'],
        },
        available_conditions: ['open_box'],
        variants: [
          {
            ...primaryVariant,
            id: 'variant-s24-128',
            condition: 'open_box',
            price: 600000,
            stock_quantity: 0,
            attributes: {
              color: 'Sapphire Blue',
              storage: '128GB',
            },
          },
          {
            ...primaryVariant,
            id: 'variant-s24-256',
            condition: 'open_box',
            price: 680000,
            stock_quantity: 0,
            attributes: {
              color: 'Sapphire Blue',
              storage: '256GB',
            },
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockImplementation(
      (
        _product: unknown,
        resolvedSelection: unknown,
        _selectedCondition: unknown,
        _negotiatedPrice: unknown
      ) => {
        const selection = resolvedSelection as {
          price?: number;
          compareAtPrice?: number;
        } | null;

        return {
          price: selection?.price ?? 600000,
          comparePrice: selection?.compareAtPrice,
        };
      }
    );

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedColor: 'Sapphire Blue',
          selectedStorage: '128GB',
          canPurchase: true,
        })
      );
    });

    act(() => {
      getLastMockProps<{
        onSelectStorage: (storage: string) => void;
      }>(mockProductDetailsBody)?.onSelectStorage('256GB');
    });

    await waitFor(() => {
      const latestCall =
        mockUseEffectivePrice.mock.calls[
          mockUseEffectivePrice.mock.calls.length - 1
        ];

      expect(latestCall?.[1]).toEqual(
        expect.objectContaining({
          price: 680000,
          storage: '256GB',
          variant: expect.objectContaining({
            id: 'variant-s24-256',
          }),
        })
      );
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });
  });
});
