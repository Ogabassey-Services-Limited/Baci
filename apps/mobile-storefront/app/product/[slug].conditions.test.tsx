import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { baseProduct } from '@/lib/product-route/product-detail-screen.fixtures';
import {
  getLastMockProps,
  mockProductDetailsBody,
  mockStickyBottomActions,
  mockUseEffectivePrice,
  mockUseLocalSearchParams,
  mockUseProduct,
  ProductDetailScreen,
  resetProductDetailScreenMocks,
} from '../../test-support/product/product-detail-screen.test-utils';

describe('ProductDetailScreen condition offer stock gating', () => {
  beforeEach(() => {
    resetProductDetailScreenMocks();
  });

  it('renders a loading state while the product request is in flight', () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
    });
    mockUseProduct.mockReturnValue({
      product: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(<ProductDetailScreen />);

    expect(screen.getByText('Loading product...')).toBeTruthy();
    expect(mockStickyBottomActions).not.toHaveBeenCalled();
  });

  it('renders the not-found state when the product request fails', () => {
    mockUseLocalSearchParams.mockReturnValue({
      slug: 'iphone-13-pro',
    });
    mockUseProduct.mockReturnValue({
      product: null,
      isLoading: false,
      error: 'Product not found',
      refetch: jest.fn(),
    });

    render(<ProductDetailScreen />);

    expect(screen.getAllByText('Product not found').length).toBeGreaterThan(0);
    expect(screen.getByText('Go Back')).toBeTruthy();
    expect(mockStickyBottomActions).not.toHaveBeenCalled();
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
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: 'used',
        })
      );
      expect(getLastMockProps(mockStickyBottomActions)).toEqual(
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
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: 'open_box',
        })
      );
      expect(getLastMockProps(mockStickyBottomActions)).toEqual(
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
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: 'open_box',
        })
      );
      expect(getLastMockProps(mockStickyBottomActions)).toEqual(
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
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: null,
        })
      );
      expect(getLastMockProps(mockStickyBottomActions)).toEqual(
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
      expect(getLastMockProps(mockProductDetailsBody)).toEqual(
        expect.objectContaining({
          selectedCondition: 'open_box',
        })
      );
      expect(getLastMockProps(mockStickyBottomActions)).toEqual(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });
  });
});
