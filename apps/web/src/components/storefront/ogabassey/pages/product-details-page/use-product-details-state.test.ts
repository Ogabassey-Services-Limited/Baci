import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import { useProductDetailsState } from './use-product-details-state';

const mockAddToCart = vi.fn();
const mockApplyNegotiatedPrice = vi.fn();
const mockRemoveFromCart = vi.fn();
const mockUpdateQuantity = vi.fn();
const mockToast = vi.fn();

const mockUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('@/hooks/cart', () => ({
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
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'https://ogabassey.com/phones/pixel-9' },
    });
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
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

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://ogabassey.com/phones/pixel-9'
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Link copied!' })
    );
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
