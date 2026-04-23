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
  mockProductDetailsBody,
  mockProductImageGallery,
  mockUseEffectivePrice,
  mockUseLocalSearchParams,
  mockUseProduct,
  ProductDetailScreen,
  resetProductDetailScreenMocks,
} from './product-detail-screen.test-utils';

describe('ProductDetailScreen image-driven variant behavior', () => {
  beforeAll(() => {
    expect(primaryVariant).toBeDefined();
  });

  beforeEach(() => {
    resetProductDetailScreenMocks();
  });

  it('treats gallery thumbnail taps as the color selector for image-driven products', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-11-pro-max',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...variantProduct,
        slug: 'iphone-11-pro-max',
        manage_stock: false,
        images: [
          'https://cdn.example.com/iphone-11-green.jpg',
          'https://cdn.example.com/iphone-11-gold.jpg',
        ],
        color_images: {
          Green: ['https://cdn.example.com/iphone-11-green.jpg'],
          Gold: ['https://cdn.example.com/iphone-11-gold.jpg'],
        },
        variant_attributes: {
          color: ['Green', 'Gold'],
          storage: ['64GB'],
        },
        available_conditions: ['used'],
        variants: [
          {
            ...primaryVariant,
            id: 'variant-used-green',
            condition: 'used',
            price: 470000,
            stock_quantity: 0,
            images: ['https://cdn.example.com/iphone-11-green.jpg'],
            primary_image: 'https://cdn.example.com/iphone-11-green.jpg',
            attributes: {
              color: 'Green',
              storage: '64GB',
            },
          },
          {
            ...primaryVariant,
            id: 'variant-used-gold',
            condition: 'used',
            price: 480000,
            stock_quantity: 0,
            images: ['https://cdn.example.com/iphone-11-gold.jpg'],
            primary_image: 'https://cdn.example.com/iphone-11-gold.jpg',
            attributes: {
              color: 'Gold',
              storage: '64GB',
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
        _product,
        resolvedSelection: unknown,
        _selectedCondition,
        _negotiatedPrice
      ) => {
        const selection = resolvedSelection as {
          price?: number;
          compareAtPrice?: number;
        } | null;

        return {
          price: selection?.price ?? 470000,
          comparePrice: selection?.compareAtPrice,
        };
      }
    );

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedColor: 'Green',
        })
      );
    });

    act(() => {
      getLastMockProps<{
        setSelectedImageIndex: (index: number) => void;
      }>(mockProductImageGallery)?.setSelectedImageIndex(1);
    });

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedColor: 'Gold',
          canPurchase: true,
        })
      );
    });
  });

  it('passes derived color-image mappings into the details body so image-driven products do not need a separate color wheel', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-11-pro-max',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...variantProduct,
        slug: 'iphone-11-pro-max',
        manage_stock: false,
        images: [
          'https://cdn.example.com/iphone-11-green.jpg',
          'https://cdn.example.com/iphone-11-gold.jpg',
        ],
        color_images: {},
        variant_attributes: null,
        available_conditions: ['used'],
        variants: [
          {
            ...primaryVariant,
            id: 'variant-used-green',
            condition: 'used',
            price: 470000,
            stock_quantity: 0,
            images: ['https://cdn.example.com/iphone-11-green.jpg'],
            primary_image: 'https://cdn.example.com/iphone-11-green.jpg',
            attributes: {
              color: 'Green',
              storage: '64GB',
            },
          },
          {
            ...primaryVariant,
            id: 'variant-used-gold',
            condition: 'used',
            price: 480000,
            stock_quantity: 0,
            images: ['https://cdn.example.com/iphone-11-gold.jpg'],
            primary_image: 'https://cdn.example.com/iphone-11-gold.jpg',
            attributes: {
              color: 'Gold',
              storage: '64GB',
            },
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
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          product: expect.objectContaining({
            color_images: {
              Gold: ['https://cdn.example.com/iphone-11-gold.jpg'],
              Green: ['https://cdn.example.com/iphone-11-green.jpg'],
            },
          }),
        })
      );
    });
  });

  it('repairs an invalid condition change inside the newly selected condition instead of snapping back to the default variant', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'samsung-galaxy-s24',
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...variantProduct,
        slug: 'samsung-galaxy-s24',
        price: 680000,
        manage_stock: false,
        variant_attributes: null,
        available_conditions: ['open_box', 'used'],
        variants: [
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
          {
            ...primaryVariant,
            id: 'variant-used-128',
            condition: 'used',
            price: 520000,
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
    mockUseEffectivePrice.mockImplementation(
      (
        _product,
        resolvedSelection: unknown,
        _selectedCondition,
        _negotiatedPrice
      ) => {
        const sel = resolvedSelection as {
          price?: number;
          compareAtPrice?: number;
        } | null;
        return {
          price: sel?.price ?? 680000,
          comparePrice: sel?.compareAtPrice,
        };
      }
    );

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: 'used',
          selectedStorage: '128GB',
        })
      );
    });

    act(() => {
      getLastMockProps<{
        setSelectedCondition: (condition: 'open_box' | 'used') => void;
      }>(mockProductDetailsBody)?.setSelectedCondition('open_box');
    });

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: 'open_box',
          selectedStorage: '256GB',
        })
      );

      const latestCall =
        mockUseEffectivePrice.mock.calls[
          mockUseEffectivePrice.mock.calls.length - 1
        ];

      expect(latestCall?.[1]).toEqual(
        expect.objectContaining({
          condition: 'open_box',
          price: 680000,
          storage: '256GB',
          variant: expect.objectContaining({
            id: 'variant-open-box-256',
          }),
        })
      );
    });
  });
});
