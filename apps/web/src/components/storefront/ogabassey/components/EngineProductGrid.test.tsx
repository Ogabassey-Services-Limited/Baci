import type { Product } from '@/lib/products';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMerchantSafe } from '@/hooks/use-merchant';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));
vi.mock('@baci/shared', () => ({
  prioritizeSmartphoneProducts: vi.fn(
    (products: unknown[]) => products
  ),
}));
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/test-store'),
}));
vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(() => ({
    cart: [],
    items: [],
    addToCart: vi.fn(),
    totalItems: 0,
  })),
}));
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test' },
    basePath: '/test-store',
  })),
}));
vi.mock('@/lib/routes', () => ({
  buildStorefrontPath: vi.fn((...parts: Array<string | undefined>) => {
    const segments = parts
      .flatMap((part) => (part ? part.split('/') : []))
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment));

    return `/${segments.join('/')}`;
  }),
}));
vi.mock('../data/products', () => ({ products: [] }));
vi.mock('../providers/v2-saved-context', () => ({
  useV2Saved: vi.fn(() => ({
    savedIds: new Set(),
    toggleSaved: vi.fn(),
    isSaved: vi.fn(() => false),
  })),
}));
vi.mock('./AdUnit', () => ({ AdUnit: () => null }));
vi.mock('./AdvancedProductFilters', () => ({
  AdvancedProductFilters: () => null,
}));
vi.mock('./FloatingParticles', () => ({
  FloatingParticles: () => null,
}));
vi.mock('./ProductGridItem', () => ({
  ProductGridItem: ({ product }: { product: { name: string } }) => (
    <article>{product.name}</article>
  ),
}));
vi.mock('./ProductListItem', () => ({
  ProductListItem: () => <div data-testid="list-item" />,
}));

import { prioritizeSmartphoneProducts } from '@baci/shared';
import { EngineProductGrid } from './EngineProductGrid';

function createTestProduct(overrides: Partial<Product>): Product {
  return {
    id: 'product-1',
    name: 'Test Product',
    description: '',
    status: 'active',
    price: 1000,
    manage_stock: true,
    stock: 1,
    image: '',
    imageLarge: '',
    imageHint: '',
    brand: '',
    gtin: '',
    mpn: '',
    images: [],
    ...overrides,
  };
}

describe('EngineProductGrid', () => {
  it('renders without crashing with empty products', () => {
    const { container } = render(
      <EngineProductGrid externalProducts={[]} categories={[]} />
    );
    expect(container).toBeDefined();
  });

  it('passes products through prioritizeSmartphoneProducts', () => {
    render(
      <EngineProductGrid
        externalProducts={[
          createTestProduct({
            id: 'tv-1',
            name: 'Samsung TV',
            price: 2000000,
            category: 'Smart TVs',
            stock: 2,
            brand: 'Samsung',
          }),
          createTestProduct({
            id: 'phone-1',
            name: 'iPhone 16',
            price: 1800000,
            category: 'Smartphones',
            stock: 4,
            brand: 'Apple',
          }),
        ]}
        categories={[]}
      />
    );

    expect(vi.mocked(prioritizeSmartphoneProducts)).toHaveBeenCalled();
    // Deterministic stub returns products in original order
    expect(screen.getAllByRole('article').map((item) => item.textContent)).toEqual(
      ['Samsung TV', 'iPhone 16']
    );
  });

  it('links the view-all CTA to the products index route', () => {
    render(
      <EngineProductGrid
        externalProducts={[
          createTestProduct({
            id: 'phone-1',
            name: 'iPhone 16',
            category: 'Smartphones',
            stock: 4,
          }),
        ]}
        categories={[{ name: 'Smartphones', slug: 'smartphones' }]}
      />
    );

    expect(
      screen.getByRole('link', { name: 'View all products' })
    ).toHaveAttribute('href', '/test-store/products');
    expect(
      screen.getByRole('link', { name: 'View all products' }).className
    ).toContain('text-[color:var(--store-foreground');
    expect(
      screen.getByRole('link', { name: 'View all products' }).className
    ).toContain('hover:text-[color:var(--store-primary');
  });

  it('uses /products when basePath is empty', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { id: 'm-1', slug: 'test' },
      basePath: '',
    } as ReturnType<typeof useMerchantSafe>);

    render(
      <EngineProductGrid
        externalProducts={[createTestProduct({ id: 'phone-1', stock: 4 })]}
        categories={[]}
      />
    );

    expect(
      screen.getByRole('link', { name: 'View all products' })
    ).toHaveAttribute('href', '/products');
  });

  it('falls back to storeSlug when MerchantProvider is absent', () => {
    vi.mocked(useMerchantSafe).mockReturnValue(null);

    render(
      <EngineProductGrid
        storeSlug="test-store"
        externalProducts={[createTestProduct({ id: 'phone-1', stock: 4 })]}
        categories={[]}
      />
    );

    expect(
      screen.getByRole('link', { name: 'View all products' })
    ).toHaveAttribute('href', '/test-store/products');
  });

  it('uses /products when basePath is root', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { id: 'm-1', slug: 'test' },
      basePath: '/',
    } as ReturnType<typeof useMerchantSafe>);

    render(
      <EngineProductGrid
        externalProducts={[createTestProduct({ id: 'phone-1', stock: 4 })]}
        categories={[]}
      />
    );

    expect(
      screen.getByRole('link', { name: 'View all products' })
    ).toHaveAttribute('href', '/products');
  });
});
