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

  it('pre-selects variant attributes from ?variant= URL param', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('variant=var-2'));

    const productWithVariants = {
      ...baseProduct,
      variants: [
        { id: 'var-1', attributes: { color: 'Black', storage: '128GB' } },
        { id: 'var-2', attributes: { color: 'Silver', storage: '256GB' } },
      ],
    } as Product;

    const { result } = renderHook(() =>
      useProductDetailsState(productWithVariants)
    );

    // The matching variant's attributes should be pre-selected
    expect(result.current.selectedAttributes).toEqual({
      color: 'Silver',
      storage: '256GB',
    });
    // Color index for "Silver" should be pre-selected (index 1 in baseProduct.colors)
    expect(result.current.selectedColor).toBe(1);
  });

  it('falls back to empty attributes when ?variant= does not match any variant', () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('variant=nonexistent-id')
    );

    const productWithVariants = {
      ...baseProduct,
      variants: [
        { id: 'var-1', attributes: { color: 'Black', storage: '128GB' } },
      ],
    } as Product;

    const { result } = renderHook(() =>
      useProductDetailsState(productWithVariants)
    );

    expect(result.current.selectedAttributes).toEqual({});
  });

  it('re-syncs variant-derived state when the product and query change', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('variant=var-2'));

    const initialProduct = {
      ...baseProduct,
      variants: [
        { id: 'var-1', attributes: { color: 'Black', storage: '128GB' } },
        { id: 'var-2', attributes: { color: 'Silver', storage: '256GB' } },
      ],
    } as Product;
    const nextProduct = {
      ...baseProduct,
      id: 'product-2',
      name: 'Pixel Fold',
      image: 'https://example.com/fold-default.jpg',
      images: [
        'https://example.com/fold-default.jpg',
        'https://example.com/purple.jpg',
      ],
      colors: ['Purple'],
      color_images: {
        Purple: ['https://example.com/purple.jpg'],
      },
      variants: [
        { id: 'var-3', attributes: { color: 'Purple', storage: '512GB' } },
      ],
    } as Product;

    const { result, rerender } = renderHook(
      ({ product }) => useProductDetailsState(product),
      {
        initialProps: { product: initialProduct },
      }
    );

    act(() => {
      result.current.handleColorDoubleClick(0);
    });
    expect(result.current.secondaryColor).toBe(0);

    mockUseSearchParams.mockReturnValue(new URLSearchParams('variant=var-3'));
    rerender({ product: nextProduct });

    expect(result.current.selectedAttributes).toEqual({
      color: 'Purple',
      storage: '512GB',
    });
    expect(result.current.selectedColor).toBe(0);
    expect(result.current.selectedImage).toBe(1);
    expect(result.current.secondaryColor).toBeNull();
  });
});
