import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalMatchMedia = window.matchMedia;

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

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ slug: 'test', category: 'electronics' })),
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}));
vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(() => ({ items: [], addToCart: vi.fn(), totalItems: 0 })),
}));
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test', business_name: 'Test Store' },
    basePath: '/test-store',
  })),
}));
vi.mock('@/lib/routes', () => ({ asRoute: vi.fn((p: string) => p) }));
vi.mock('@/lib/sanitize', () => ({ sanitizeHtml: vi.fn((s: string) => s) }));
vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../components/AdUnit', () => ({ AdUnit: () => null }));
vi.mock('../components/BannerCarousel', () => ({ BannerCarousel: () => null }));
vi.mock('../components/CategoryFiltersSidebar', () => ({
  CategoryFiltersSidebar: () => null,
}));
vi.mock('../components/ProductCard', () => ({
  ProductCard: ({ product }: { product: { name: string } }) => (
    <article aria-label={product.name} />
  ),
}));

import { CategoryPage } from './category-page';

describe('CategoryPage', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders the category banner region on desktop', () => {
    mockMatchMedia(true);

    render(<CategoryPage products={[]} />);

    const banner = screen.getByRole('region', {
      name: /category banner carousel/i,
    });
    expect(banner).toBeInTheDocument();
  });

  it('does not render the category banner region on mobile', () => {
    mockMatchMedia(false);

    render(<CategoryPage products={[]} />);

    expect(
      screen.queryByRole('region', { name: /category banner carousel/i })
    ).not.toBeInTheDocument();
  });

  it('renders crawlable pagination links for category results', () => {
    mockMatchMedia(true);

    const products = Array.from({ length: 25 }, (_, index) => ({
      id: String(index + 1),
      name: `Product ${index + 1}`,
      slug: `product-${index + 1}`,
      description: `Description ${index + 1}`,
      price: `₦${index + 1}`,
      rawPrice: index + 1,
      image: '',
      condition: 'New' as const,
    }));

    render(<CategoryPage currentPage={2} products={products} />);

    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(
      screen.getByText('Showing 21-25 of 25 products')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /load more products/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1' })).toHaveAttribute(
      'href',
      '/test-store/electronics'
    );
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/test-store/electronics'
    );
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute(
      'href',
      '/test-store/electronics?page=2'
    );
  });

  it('falls back to the default storefront page size when itemsPerPage is invalid', () => {
    mockMatchMedia(true);

    const products = Array.from({ length: 25 }, (_, index) => ({
      id: String(index + 1),
      name: `Product ${index + 1}`,
      slug: `product-${index + 1}`,
      description: `Description ${index + 1}`,
      price: `₦${index + 1}`,
      rawPrice: index + 1,
      image: '',
      condition: 'New' as const,
    }));

    render(
      <CategoryPage currentPage={2} itemsPerPage={0} products={products} />
    );

    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(
      screen.getByText('Showing 21-25 of 25 products')
    ).toBeInTheDocument();
  });
});
