import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({ items: [], addToCart: vi.fn(), totalItems: 0 })),
}));
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({ merchant: { id: 'm-1', slug: 'test' } })),
}));
vi.mock('@/lib/routes', () => ({ asRoute: vi.fn((p: string) => p) }));
vi.mock('./AdvancedProductFilters', () => ({ AdvancedProductFilters: () => null }));
vi.mock('./NativeProductRow', () => ({ NativeProductRow: () => null }));
vi.mock('./FloatingParticles', () => ({ FloatingParticles: () => null }));
vi.mock('./ProductCard', () => ({
  ProductCard: () => <div data-testid="product-card" />,
}));

import { InteractiveProductGrid } from './InteractiveProductGrid';

describe('InteractiveProductGrid', () => {
  it('renders without crashing with empty products', () => {
    const { container } = render(<InteractiveProductGrid products={[]} />);
    expect(container).toBeDefined();
  });
});
