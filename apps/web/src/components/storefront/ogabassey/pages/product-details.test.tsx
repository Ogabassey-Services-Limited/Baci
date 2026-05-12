import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toggleSaved: vi.fn(),
  isSaved: vi.fn(() => false),
}));

vi.mock('next/image', () => ({
  default: () => 'img',
}));
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}));
vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
    items: [],
    addToCart: vi.fn(),
    totalItems: 0,
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
  })),
}));
vi.mock('../components/AdUnit', () => ({ AdUnit: () => 'AdUnit' }));
vi.mock('../components/BannerCarousel', () => ({ BannerCarousel: () => 'BannerCarousel' }));
vi.mock('../components/BlogSnippet', () => ({ BlogSnippet: () => 'BlogSnippet' }));
vi.mock('../contexts/ComparisonContext', () => ({
  useComparison: vi.fn(() => ({
    comparisonIds: new Set(),
    toggleComparison: vi.fn(),
  })),
}));
vi.mock('../contexts/SavedContext', () => ({
  useSaved: vi.fn(() => ({
    savedItems: [],
    toggleSaved: mocks.toggleSaved,
    isSaved: mocks.isSaved,
    toastState: { show: false, message: '', type: 'add' },
    dismissToast: vi.fn(),
  })),
}));
vi.mock('../data/products', () => ({
  products: [],
}));

import { OgabasseyV2ProductDetails } from './product-details';

describe('OgabasseyV2ProductDetails', () => {
  beforeEach(() => {
    mocks.toggleSaved.mockReset();
    mocks.isSaved.mockReset();
    mocks.isSaved.mockReturnValue(false);
    window.scrollTo = vi.fn();
  });

  it('exports a valid component', () => {
    expect(OgabasseyV2ProductDetails).toBeDefined();
    expect(typeof OgabasseyV2ProductDetails).toBe('function');
  });

  it('does not submit an enclosing form when adding a product to the wishlist', () => {
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <OgabasseyV2ProductDetails productId="1" />
      </form>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.toggleSaved).toHaveBeenCalled();
  });

  it('does not submit an enclosing form when removing a product from the wishlist', () => {
    mocks.isSaved.mockReturnValue(true);
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <OgabasseyV2ProductDetails productId="1" />
      </form>
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove from wishlist' })
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.toggleSaved).toHaveBeenCalled();
  });
});
