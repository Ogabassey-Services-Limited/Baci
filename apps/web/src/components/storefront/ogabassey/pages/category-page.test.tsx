import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
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
  })),
}));
vi.mock('@/lib/routes', () => ({ asRoute: vi.fn((p: string) => p) }));
vi.mock('@/lib/sanitize', () => ({ sanitizeHtml: vi.fn((s: string) => s) }));
vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../components/AdUnit', () => ({ AdUnit: () => null }));
vi.mock('../components/BannerCarousel', () => ({ BannerCarousel: () => null }));
vi.mock('../components/CategoryFiltersSidebar', () => ({
  CategoryFiltersSidebar: () => null,
}));
vi.mock('../components/ProductCard', () => ({
  ProductCard: () => <div data-testid="product-card" />,
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

  it('paginates category products with a load more button', async () => {
    mockMatchMedia(true);

    const user = userEvent.setup();
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

    render(<CategoryPage products={products} />);

    expect(screen.getAllByTestId('product-card')).toHaveLength(20);
    expect(
      screen.getByText('Showing 20 of 25 products')
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /load more products/i })
    );

    expect(screen.getAllByTestId('product-card')).toHaveLength(25);
    expect(
      screen.queryByRole('button', { name: /load more products/i })
    ).not.toBeInTheDocument();
  });
});
