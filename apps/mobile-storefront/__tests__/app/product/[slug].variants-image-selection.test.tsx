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
} from '../../../test-support/product/product-detail-screen.test-utils';

describe('ProductDetailScreen image selection edge cases', () => {
  beforeAll(() => {
    expect(primaryVariant).toBeDefined();
  });

  beforeEach(() => {
    resetProductDetailScreenMocks();
  });

  it('clamps selectedImageIndex back to 0 when the gallery shrinks', async () => {
    // The product starts with two variants → two gallery images. After the
    // shopper picks index 1, we mutate the store to a single-image product
    // and expect the screen to clamp the index back to 0 instead of pointing
    // off the end of the new images array.
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-11-pro-max',
    });

    const refetch = jest.fn();
    const initialProduct = {
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
          attributes: { color: 'Green', storage: '64GB' },
        },
        {
          ...primaryVariant,
          id: 'variant-used-gold',
          condition: 'used',
          price: 480000,
          stock_quantity: 0,
          images: ['https://cdn.example.com/iphone-11-gold.jpg'],
          primary_image: 'https://cdn.example.com/iphone-11-gold.jpg',
          attributes: { color: 'Gold', storage: '64GB' },
        },
      ],
    };

    mockUseProduct.mockReturnValue({
      product: initialProduct,
      isLoading: false,
      error: null,
      refetch,
    });
    mockUseEffectivePrice.mockReturnValue({
      price: 470000,
      comparePrice: undefined,
    });

    const { rerender } = render(<ProductDetailScreen />);

    // Move the gallery index to the second image first.
    await waitFor(() => {
      expect(getLastMockProps(mockProductImageGallery)).toBeDefined();
    });

    act(() => {
      getLastMockProps<{
        setSelectedImageIndex: (index: number) => void;
      }>(mockProductImageGallery)?.setSelectedImageIndex(1);
    });

    await waitFor(() => {
      expect(getLastMockProps(mockProductImageGallery)).toEqual(
        expect.objectContaining({ selectedImageIndex: 1 })
      );
    });

    // Now shrink the product to a single-image variant set and re-render.
    const shrunkProduct = {
      ...initialProduct,
      images: ['https://cdn.example.com/iphone-11-green.jpg'],
      color_images: {
        Green: ['https://cdn.example.com/iphone-11-green.jpg'],
      },
      variant_attributes: {
        color: ['Green'],
        storage: ['64GB'],
      },
      variants: [initialProduct.variants[0]],
    };
    mockUseProduct.mockReturnValue({
      product: shrunkProduct,
      isLoading: false,
      error: null,
      refetch,
    });

    rerender(<ProductDetailScreen />);

    await waitFor(() => {
      expect(getLastMockProps(mockProductImageGallery)).toEqual(
        expect.objectContaining({ selectedImageIndex: 0 })
      );
    });
  });

  it('keeps the current selection when the tapped image has no color tag and no matching variant', async () => {
    // Scenario: the image at index 2 is in the gallery but is NOT in any
    // variant's `images`/`primary_image` AND is not present in `color_images`.
    // `resolveVariantSelectionFromImage` returns null and the image-color map
    // also yields nothing, so the handler must early-return without clearing
    // the variant or changing the color.
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
          // Lifestyle/marketing image that doesn't belong to any variant and
          // isn't tagged with a color.
          'https://cdn.example.com/iphone-11-lifestyle.jpg',
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
            stock_quantity: 1,
            images: ['https://cdn.example.com/iphone-11-green.jpg'],
            primary_image: 'https://cdn.example.com/iphone-11-green.jpg',
            attributes: { color: 'Green', storage: '64GB' },
          },
          {
            ...primaryVariant,
            id: 'variant-used-gold',
            condition: 'used',
            price: 480000,
            stock_quantity: 1,
            images: ['https://cdn.example.com/iphone-11-gold.jpg'],
            primary_image: 'https://cdn.example.com/iphone-11-gold.jpg',
            attributes: { color: 'Gold', storage: '64GB' },
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
        expect.objectContaining({ selectedColor: 'Green' })
      );
    });

    // Capture the resolved variant id BEFORE the tap so we can assert the
    // handler does not silently clear or swap it when the lifestyle image
    // matches no variant.
    const variantBeforeTap = getLastMockProps<{
      selectedVariant: string | null;
    }>(mockProductDetailsBody)?.selectedVariant;

    // Tap the lifestyle image. The handler should update the visual gallery
    // index but leave color/variant state untouched.
    act(() => {
      getLastMockProps<{
        setSelectedImageIndex: (index: number) => void;
      }>(mockProductImageGallery)?.setSelectedImageIndex(2);
    });

    await waitFor(() => {
      expect(getLastMockProps(mockProductImageGallery)).toEqual(
        expect.objectContaining({ selectedImageIndex: 2 })
      );
    });
    expect(getLastMockProps(mockProductDetailsBody)).toEqual(
      expect.objectContaining({
        selectedColor: 'Green',
        selectedVariant: variantBeforeTap,
      })
    );
  });
});
