import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryHubModel } from '@/lib/storefront-category/category-hub-types';

const originalMatchMedia = window.matchMedia;
const mockAddToCart = vi.fn();

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
  default: ({
    children,
    prefetch: _prefetch,
    ...props
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  }) => <a {...props}>{children}</a>,
}));
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ slug: 'test', category: 'electronics' })),
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}));
vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
    items: [],
    addToCart: mockAddToCart,
    totalItems: 0,
  })),
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test', business_name: 'Test Store' },
    basePath: '/test-store',
  })),
}));
vi.mock('@/lib/routes', () => ({ asRoute: vi.fn((p: string) => p) }));
vi.mock('@/lib/sanitize', () => ({ sanitizeHtml: vi.fn((s: string) => s) }));
vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('@/components/ui/safe-html', () => ({
  SafeHtml: ({ html }: { html: string }) => (
    <div>{html.replace(/<[^>]+>/g, '')}</div>
  ),
}));
vi.mock('../components/AdUnit', () => ({ AdUnit: () => null }));
vi.mock('../components/CategoryRecentCarousel', () => ({
  CategoryRecentCarousel: () => (
    <section aria-label="Recently added products" />
  ),
}));
vi.mock('../components/CategoryFiltersSidebar', () => ({
  CategoryFiltersSidebar: () => null,
}));
vi.mock('../components/ProductCard', () => ({
  ProductCard: ({
    product,
    isAdded,
    onAddToCart,
  }: {
    product: { name: string };
    isAdded?: boolean;
    onAddToCart?: (event: React.MouseEvent, product: unknown) => void;
  }) => (
    <article aria-label={product.name}>
      <button type="button" onClick={(event) => onAddToCart?.(event, product)}>
        Add {product.name}
      </button>
      <span>{isAdded ? 'Added' : 'Idle'}</span>
    </article>
  ),
}));

import { useParams } from 'next/navigation';
import { CategoryPage } from './category-page';

describe('CategoryPage', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    mockAddToCart.mockReset();
    vi.mocked(useParams).mockReturnValue({
      slug: 'test',
      category: 'electronics',
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  const PRODUCT_WITH_IMAGE = {
    id: '1',
    name: 'Newest Phone',
    slug: 'newest-phone',
    description: 'A newly added phone',
    price: '₦100',
    rawPrice: 100,
    image: 'https://cdn.ogabassey.com/newest.avif',
    condition: 'New' as const,
  };

  it('renders the recently-added product carousel in place of the promo banner', () => {
    mockMatchMedia(true);

    render(<CategoryPage products={[PRODUCT_WITH_IMAGE]} />);

    expect(screen.getByRole('region', { name: /recently added products/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: /category banner carousel/i })
    ).not.toBeInTheDocument();
  });

  it.each(['best-sellers', 'on-sale', 'featured'])(
    'hides the recent carousel on the sorted collection route "%s" (not created_at ordered)',
    (collection) => {
      mockMatchMedia(true);
      vi.mocked(useParams).mockReturnValue({
        slug: 'test',
        category: collection,
      });

      render(<CategoryPage products={[PRODUCT_WITH_IMAGE]} />);

      expect(
        screen.queryByRole('region', { name: /recently added products/i })
      ).not.toBeInTheDocument();
    }
  );

  it('hides the recent carousel on later pre-paginated pages (page slice is not the newest items)', () => {
    mockMatchMedia(true);

    render(
      <CategoryPage
        currentPage={2}
        products={[]}
        productsArePrePaginated={true}
        totalProductCount={25}
      />
    );

    expect(
      screen.queryByRole('region', { name: /recently added products/i })
    ).not.toBeInTheDocument();
  });

  it('still shows the recent carousel on the first pre-paginated page', () => {
    mockMatchMedia(true);

    render(
      <CategoryPage
        currentPage={1}
        products={[PRODUCT_WITH_IMAGE]}
        productsArePrePaginated={true}
        totalProductCount={25}
      />
    );

    expect(screen.getByRole('region', { name: /recently added products/i })).toBeInTheDocument();
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
    expect(
      screen.getByRole('link', { name: 'Electronics page 2' })
    ).toHaveAttribute('href', '/test-store/electronics?page=2');
  });

  it('uses explicit total product count when server sends only the current page slice', () => {
    mockMatchMedia(true);

    const products = [
      {
        id: '25',
        name: 'Recovered Product',
        slug: 'recovered-product',
        description: 'Recovered detail row',
        price: '₦25',
        rawPrice: 25,
        image: '',
        condition: 'New' as const,
      },
    ];
    const prePaginatedProps = {
      currentPage: 2,
      products,
      productsArePrePaginated: true,
      totalProductCount: 25,
    } as unknown as React.ComponentProps<typeof CategoryPage>;

    render(<CategoryPage {...prePaginatedProps} />);

    expect(screen.getByRole('article', { name: 'Recovered Product' }))
      .toBeInTheDocument();
    expect(
      screen.getByText('Showing 21-21 of 25 products')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /filters/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/test-store/electronics'
    );
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute(
      'href',
      '/test-store/electronics?page=2'
    );
  });

  it('keeps pagination reachable when a pre-paginated detail slice is empty', () => {
    mockMatchMedia(true);

    render(
      <CategoryPage
        currentPage={2}
        products={[]}
        productsArePrePaginated={true}
        totalProductCount={25}
      />
    );

    expect(screen.queryByText('No products found')).not.toBeInTheDocument();
    expect(
      screen.getByText('Products on this page are temporarily unavailable.')
    ).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
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

  it('renders the extracted category hub sections when a hub model is provided', () => {
    mockMatchMedia(true);

    const categoryHubModel: CategoryHubModel = {
      intro: {
        heading: 'Buy Smartphones in Nigeria',
        description: 'Compare current picks by battery, camera, and price.',
        source: 'curated',
      },
      trustFeatures: ['Warranty-backed picks', 'Fast nationwide delivery'],
      bestForCards: [],
      brandCards: [],
      priceBandCards: [],
      comparisonLinks: [
        {
          href: '/test-store/electronics/compare/apple-vs-samsung',
          label: 'Apple vs Samsung',
        },
      ],
      guideLinks: [
        {
          href: '/test-store/blog/best-phones-in-nigeria',
          title: 'Best Phones in Nigeria',
          description: 'Budget and flagship picks.',
          kind: 'best-in-nigeria',
        },
      ],
      faqItems: [
        {
          question: 'What matters most?',
          answer: '<p>Battery, camera, and storage.</p>',
        },
      ],
    };

    render(<CategoryPage hubContent={categoryHubModel} products={[]} />);

    expect(
      screen.getByRole('heading', { name: 'Buy Smartphones in Nigeria' })
    ).toBeInTheDocument();
    expect(screen.getByText('Warranty-backed picks')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Apple vs Samsung' })
    ).toHaveAttribute(
      'href',
      '/test-store/electronics/compare/apple-vs-samsung'
    );
    expect(
      screen.getByText('Battery, camera, and storage.')
    ).toBeInTheDocument();
  });

  it('builds hub content from legacy seo props when hubContent is absent', () => {
    mockMatchMedia(true);

    render(
      <CategoryPage
        seoHeading="Shop Smartphones in Nigeria"
        seoDescription="Compare curated picks by battery and camera."
        seoFeatures={['Trusted warranty', 'Fast delivery']}
        seoFaqs={[
          {
            question: 'Which phone lasts longer?',
            answer: '<p>Battery size and charging speed both matter.</p>',
          },
        ]}
        products={[]}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Shop Smartphones in Nigeria' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Compare curated picks by battery and camera.')
    ).toBeInTheDocument();
    expect(screen.getByText('Trusted warranty')).toBeInTheDocument();
    expect(screen.getByText('Fast delivery')).toBeInTheDocument();
    expect(
      screen.getByText('Battery size and charging speed both matter.')
    ).toBeInTheDocument();
  });

  it('passes a numeric cart price when adding a category product', () => {
    mockMatchMedia(true);

    render(
      <CategoryPage
        products={[
          {
            id: '1',
            name: 'Galaxy S',
            slug: 'galaxy-s',
            description: 'Flagship phone',
            price: '₦123,000',
            rawPrice: 123000,
            image: '/galaxy-s.jpg',
            condition: 'New',
            brand: 'Samsung',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Galaxy S' }));

    expect(mockAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        name: 'Galaxy S',
        price: 123000,
      }),
      1
    );
  });

  it('clears the transient added state for string product ids after the timeout', () => {
    vi.useFakeTimers();
    mockMatchMedia(true);

    render(
      <CategoryPage
        products={[
          {
            id: 'uuid-1',
            name: 'Galaxy S',
            slug: 'galaxy-s',
            description: 'Flagship phone',
            price: '₦123,000',
            rawPrice: 123000,
            image: '/galaxy-s.jpg',
            condition: 'New',
            brand: 'Samsung',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Galaxy S' }));
    expect(screen.getByText('Added')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Idle')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
