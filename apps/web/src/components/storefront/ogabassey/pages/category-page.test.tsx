import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
  it('renders without crashing with empty products', () => {
    render(<CategoryPage products={[]} />);

    const banner = screen.getByTestId('category-banner-carousel');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveClass('hidden', 'md:block');
  });
});
