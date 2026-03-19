import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(min-width: 768px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} alt={props.alt as string} />,
}));
vi.mock('next/dynamic', async () => {
  const React = await import('react');

  return {
    default: (loader: () => Promise<unknown>) => {
      return function DynamicComponent(props: Record<string, unknown>) {
        const [Component, setComponent] = React.useState<React.ComponentType<Record<string, unknown>> | null>(null);

        React.useEffect(() => {
          let active = true;

          loader().then((mod) => {
            const resolved =
              typeof mod === 'object' && mod !== null && 'default' in mod
                ? (mod.default as React.ComponentType<Record<string, unknown>>)
                : (mod as React.ComponentType<Record<string, unknown>>);

            if (active) {
              setComponent(() => resolved);
            }
          });

          return () => {
            active = false;
          };
        }, []);

        return Component ? <Component {...props} /> : null;
      };
    },
  };
});
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

vi.mock('../components/BlogSnippet', () => ({
  BlogSnippet: () => null,
}));

import { ProductDetailsPage } from './product-details-page';

describe('ProductDetailsPage', () => {
  beforeEach(() => {
    mockMatchMedia(true);
    window.scrollTo = vi.fn();
  });

  it('renders the product page shell', async () => {
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

    const banner = screen.getByRole('region', {
      name: /product banner carousel/i,
    });
    expect(banner).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Description' })).toBeInTheDocument();
  });

  it('uses the real review count and exposes the reviews tab panel semantics', async () => {
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

    const reviewsTab = await screen.findByRole('tab', { name: 'Reviews (7)' });
    expect(reviewsTab).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Reviews (124)' })).not.toBeInTheDocument();

    fireEvent.click(reviewsTab);

    expect(
      await screen.findByRole('tabpanel', { name: 'Reviews (7)' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Based on 7 reviews')).toBeInTheDocument();
  });

  it('shows the empty review state when rating data is missing', async () => {
    render(
      <ProductDetailsPage
        product={{
          id: 'p-3',
          name: 'No Reviews Product',
          price: '₦7,500',
          image: 'https://example.com/no-reviews.jpg',
          description: 'No reviews yet',
          condition: 'new' as const,
          colors: [],
          storage: [],
          images: ['https://example.com/no-reviews.jpg'],
        }}
      />
    );

    const reviewsTab = await screen.findByRole('tab', { name: 'Reviews (0)' });
    fireEvent.click(reviewsTab);

    expect(
      await screen.findByRole('tabpanel', { name: 'Reviews (0)' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Based on 0 reviews')).toBeInTheDocument();
  });

  it('renders a fallback shell when image and description data are missing', () => {
    render(
      <ProductDetailsPage
        product={{
          id: 'p-4',
          name: 'Minimal Product',
          price: '₦2,500',
          image: '',
          description: '',
          condition: 'new' as const,
          colors: [],
          storage: [],
          images: [],
        }}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Minimal Product' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /product banner carousel/i })
    ).toBeInTheDocument();
  });
});
