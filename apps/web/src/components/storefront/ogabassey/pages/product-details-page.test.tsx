import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} alt={props.alt as string} />,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ slug: 'test', productSlug: 'test-product' })),
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(() => ({
    cart: [],
    items: [],
    addToCart: vi.fn(),
    totalItems: 0,
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    applyNegotiatedPrice: vi.fn(),
  })),
}));
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test', business_name: 'Test' },
    basePath: '',
  })),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));
vi.mock('@/components/storefront/brand-products', () => ({
  BrandProducts: () => null,
}));
vi.mock('@/components/storefront/price-range-products', () => ({
  PriceRangeProducts: () => null,
}));

// Mock the V2SavedProvider context
vi.mock('../providers/v2-saved-context', () => ({
  useV2Saved: vi.fn(() => ({
    savedItems: [],
    toggleSaved: vi.fn(),
    isSaved: vi.fn(() => false),
    toastState: { show: false, message: '', type: 'add' },
    dismissToast: vi.fn(),
  })),
  V2SavedProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Mock the remaining component dependencies
vi.mock('../components/AdUnit', () => ({
  AdUnit: () => null,
}));
vi.mock('../components/BannerCarousel', () => ({
  BannerCarousel: () => null,
}));
vi.mock('../components/BlogSnippet', () => ({
  BlogSnippet: () => null,
}));
vi.mock('../components/NegotiationModal', () => ({
  NegotiationModal: () => null,
}));
vi.mock('../components/ProductComparisonTable', () => ({
  ProductComparisonTable: () => null,
}));
vi.mock('../components/ProductVideo', () => ({
  ProductVideo: () => null,
}));
vi.mock('../components/FlyToCartAnimation', () => ({
  FlyToCartAnimation: () => null,
}));

import { ProductDetailsPage } from './product-details-page';

describe('ProductDetailsPage', () => {
  it('renders the product page shell', () => {
    render(
      <ProductDetailsPage product={{
        id: 'p-1',
        name: 'Test Product',
        price: '₦5,000',
        image: 'https://example.com/img.jpg',
        description: 'A test product',
        condition: 'new' as const,
        colors: [],
        storage: [],
        images: ['https://example.com/img.jpg'],
      }} />
    );

    const banner = screen.getByTestId('product-banner-carousel');
    expect(banner).toBeInTheDocument();
  });

  it('uses the real review count and exposes the reviews tab panel semantics', () => {
    render(
      <ProductDetailsPage product={{
        id: 'p-2',
        name: 'Reviewed Product',
        price: '₦15,000',
        image: 'https://example.com/reviewed.jpg',
        description: 'A reviewed product',
        condition: 'new' as const,
        colors: [],
        storage: [],
        images: ['https://example.com/reviewed.jpg'],
        reviews: 7,
        rating: 4.5,
      }} />
    );

    const reviewsTab = screen.getByRole('tab', { name: 'Reviews (7)' });
    expect(reviewsTab).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Reviews (124)' })).not.toBeInTheDocument();

    fireEvent.click(reviewsTab);

    expect(screen.getByRole('tabpanel', { name: 'Reviews (7)' })).toBeInTheDocument();
    expect(screen.getByText('Based on 7 reviews')).toBeInTheDocument();
  });
});
