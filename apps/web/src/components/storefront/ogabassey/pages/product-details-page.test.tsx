import { render } from '@testing-library/react';
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
    items: [],
    addToCart: vi.fn(),
    totalItems: 0,
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
  })),
}));
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test', business_name: 'Test' },
  })),
}));
vi.mock('@/components/storefront/brand-products', () => ({
  BrandProducts: () => null,
}));
vi.mock('@/components/storefront/price-range-products', () => ({
  PriceRangeProducts: () => null,
}));

import { ProductDetailsPage } from './product-details-page';

describe('ProductDetailsPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ProductDetailsPage product={{
        id: 'p-1',
        name: 'Test Product',
        price: '₦5,000',
        image: 'https://example.com/img.jpg',
        description: 'A test product',
        condition: 'New' as const,
      }} />
    );
    expect(container).toBeDefined();
  });
});
