import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} alt={props.alt as string} />,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(() => ({ merchant: { id: 'm-1', slug: 'test' } })),
}));
vi.mock('@/lib/routes', () => ({ asRoute: vi.fn((p: string) => p) }));
vi.mock('@/lib/seo-utils', () => ({
  getProductUrl: vi.fn(() => '/test/product'),
}));
vi.mock('../providers/v2-comparison-context', () => ({
  useV2Comparison: vi.fn(() => ({
    comparisonIds: new Set(),
    isInCompare: vi.fn(() => false),
    toggleComparison: vi.fn(),
  })),
}));
vi.mock('../providers/v2-saved-context', () => ({
  useV2Saved: vi.fn(() => ({
    savedIds: new Set(),
    isSaved: vi.fn(() => false),
    toggleSaved: vi.fn(),
  })),
}));

import { ProductCard } from './ProductCard';

const mockProduct = {
  id: 'p-1',
  name: 'Test Product',
  price: '₦5,000',
  image: 'https://example.com/img.jpg',
  description: 'A test product',
  category: 'electronics',
  slug: 'test-product',
  rating: 4.5,
  reviewCount: 10,
  condition: 'New' as const,
};

describe('ProductCard', () => {
  it('renders product name', () => {
    render(
      <ProductCard
        product={mockProduct}
        onAddToCart={vi.fn()}
        isAdded={false}
      />
    );
    expect(screen.getByText('Test Product')).toBeDefined();
  });

  it('renders with isAdded state', () => {
    const { container } = render(
      <ProductCard
        product={mockProduct}
        onAddToCart={vi.fn()}
        isAdded={true}
      />
    );
    expect(container).toBeDefined();
  });
});
