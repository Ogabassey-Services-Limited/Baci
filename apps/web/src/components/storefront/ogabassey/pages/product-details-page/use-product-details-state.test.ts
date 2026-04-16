import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import { useProductDetailsState } from './use-product-details-state';

const mockAddToCart = vi.fn();
const mockApplyNegotiatedPrice = vi.fn();
const mockRemoveFromCart = vi.fn();
const mockShareProductLink = vi.fn().mockResolvedValue(undefined);
const mockUpdateQuantity = vi.fn();
const mockToast = vi.fn();

const mockUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(() => ({
    addToCart: mockAddToCart,
    applyNegotiatedPrice: mockApplyNegotiatedPrice,
    cart: [],
    removeFromCart: mockRemoveFromCart,
    updateQuantity: mockUpdateQuantity,
  })),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({
    basePath: '',
    merchant: {
      id: 'merchant-1',
      slug: 'ogabassey',
      business_name: 'Ogabassey',
    },
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

vi.mock('./product-share', () => ({
  shareProductLink: (args: unknown) => mockShareProductLink(args),
}));

vi.mock('../../providers/v2-saved-context', () => ({
  useV2Saved: vi.fn(() => ({
    isSaved: vi.fn(() => false),
    toggleSaved: vi.fn(),
  })),
}));

const baseProduct: Product = {
  id: 'product-1',
  name: 'Pixel 9',
  price: '₦5,000',
  rawPrice: 5000,
  image: 'https://example.com/default.jpg',
  images: [
    'https://example.com/default.jpg',
    'https://example.com/black.jpg',
    'https://example.com/silver.jpg',
  ],
  description: '<p>Phone description</p>',
  condition: 'new',
  category: 'Phones',
  colors: ['Black', 'Silver'],
  color_images: {
    Black: ['https://example.com/black.jpg'],
    Silver: ['https://example.com/silver.jpg'],
  },
  storage: ['128GB'],
} as Product;

describe('useProductDetailsState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    cleanup();
  });

  it('updates the selected color and matching image when a color is chosen', () => {
    const { result } = renderHook(() => useProductDetailsState(baseProduct));

    act(() => {
      result.current.handleColorSelection(1);
    });

    expect(result.current.selectedColor).toBe(1);
    expect(result.current.selectedImage).toBe(2);
  });

  it('opens the selection modal when required selections are missing', () => {
    const { result } = renderHook(() => useProductDetailsState(baseProduct));

    let wasAdded = true;
    act(() => {
      wasAdded = result.current.validateAndAddToCart();
    });

    expect(wasAdded).toBe(false);
    expect(result.current.isSelectionModalOpen).toBe(true);
    expect(result.current.missingFields).toContain('Color');
    expect(mockAddToCart).not.toHaveBeenCalled();
  });

  it('copies the current url when sharing succeeds', async () => {
    const { result } = renderHook(() => useProductDetailsState(baseProduct));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(mockShareProductLink).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantName: 'Ogabassey',
        productName: 'Pixel 9',
        toast: mockToast,
        url: window.location.href,
      })
    );
  });

  it('surfaces share failures without emitting a success toast', async () => {
    mockShareProductLink.mockRejectedValueOnce(new Error('share failed'));

    const { result } = renderHook(() => useProductDetailsState(baseProduct));

    await expect(result.current.handleShare()).rejects.toThrow('share failed');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('lets live selection move away from the seeded route variant', () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('variantId=variant-new')
    );

    const { result } = renderHook(() =>
      useProductDetailsState({
        ...baseProduct,
        variant_attributes: {
          storage: ['128GB'],
        },
        variants: [
          {
            id: 'variant-new',
            condition: 'new',
            attributes: { storage: '128GB' },
            price_override: 5000,
            stock_quantity: 4,
          },
          {
            id: 'variant-used',
            condition: 'used',
            attributes: { storage: '128GB' },
            price_override: 4200,
            stock_quantity: 2,
          },
        ],
      } as Product)
    );

    expect(result.current.currentVariantDisplaySelection?.variant.id).toBe(
      'variant-new'
    );

    act(() => {
      result.current.setSelectedCondition('used');
    });

    expect(result.current.currentVariantDisplaySelection?.variant.id).toBe(
      'variant-used'
    );
  });

  it('keeps canPurchase true when a purchasable variant exists even if the display-preferred match is out of stock', () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('variantId=used-cheap-out-of-stock')
    );

    const { result } = renderHook(() =>
      useProductDetailsState({
        ...baseProduct,
        condition: 'new',
        has_variants: true,
        variants: [
          {
            id: 'used-cheap-out-of-stock',
            condition: 'used',
            attributes: { storage: '128GB' },
            price_override: 4200,
            stock_quantity: 0,
          },
          {
            id: 'used-in-stock',
            condition: 'used',
            attributes: { storage: '128GB' },
            price_override: 4800,
            stock_quantity: 3,
          },
        ],
      } as Product)
    );

    expect(result.current.currentVariantDisplaySelection?.variant.id).toBe(
      'used-cheap-out-of-stock'
    );
    expect(result.current.canPurchase).toBe(true);
  });

  it('reopens selection before applying a negotiated price when choices are missing', () => {
    const { result } = renderHook(() => useProductDetailsState(baseProduct));

    act(() => {
      result.current.handleNegotiationSuccess(4500);
    });

    expect(result.current.isSelectionModalOpen).toBe(true);
    expect(result.current.missingFields).toContain('Color');
    expect(mockApplyNegotiatedPrice).not.toHaveBeenCalled();
  });

  describe('condition query param', () => {
    it('initializes selectedCondition from ?condition=used', () => {
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams('condition=used')
      );

      const { result } = renderHook(() =>
        useProductDetailsState(baseProduct)
      );

      expect(result.current.selectedCondition).toBe('used');
    });

    it('defaults to product base condition when no condition param exists', () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      const { result } = renderHook(() =>
        useProductDetailsState(baseProduct)
      );

      expect(result.current.selectedCondition).toBe('new');
    });

    it('falls back to base condition for invalid condition param', () => {
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams('condition=invalid')
      );

      const { result } = renderHook(() =>
        useProductDetailsState(baseProduct)
      );

      expect(result.current.selectedCondition).toBe('new');
    });
  });
});
