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

describe('ProductDetailScreen condition sync behavior', () => {
  beforeAll(() => {
    expect(primaryVariant).toBeDefined();
    expect(secondaryVariant).toBeDefined();
  });

  beforeEach(() => {
    resetProductDetailScreenMocks();
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

  it('clears the pinned variant when the shopper changes condition so price can update', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
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
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: 'new',
          selectedVariant: primaryVariant.id,
        })
      );
    });

    act(() => {
      getLastMockProps<{
        setSelectedCondition: (condition: 'new' | 'used') => void;
      }>(mockProductDetailsBody)?.setSelectedCondition('used');
    });

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: 'used',
          selectedVariant: null,
        })
      );

      const latestCall =
        mockUseEffectivePrice.mock.calls[
          mockUseEffectivePrice.mock.calls.length - 1
        ];
      expect(latestCall?.[1]).toEqual(
        expect.objectContaining({
          condition: 'used',
          variant: expect.objectContaining({
            id: secondaryVariant.id,
          }),
        })
      );
      expect(latestCall?.[2]).toBe('used');
    });
  });

  it('keeps the selected storage when switching to a canonical condition backed by a legacy alias variant row', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
      condition: 'used',
      variantId: secondaryVariant.id,
    });
    mockUseProduct.mockReturnValue({
      product: {
        ...variantProduct,
        variants: [
          {
            ...primaryVariant,
            condition: 'refurbished',
          },
          secondaryVariant,
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockReturnValue({
      price: secondaryVariant.price,
      comparePrice: undefined,
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: 'used',
          selectedStorage: '128GB',
          selectedVariant: secondaryVariant.id,
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
          selectedStorage: '128GB',
          selectedVariant: null,
        })
      );
    });
  });
});
