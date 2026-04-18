import type { Product } from '@/lib/products';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@baci/shared', () => ({
  prioritizeSmartphoneProducts: vi.fn(
    (products: unknown[]) => products
  ),
}));
vi.mock('next/link', () => ({
  default: ({
    children,
    prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();

    if (source.includes('AdvancedProductFilters')) {
      return () => null;
    }

    if (source.includes('ProductListItem')) {
      return () => <div data-testid="list-item" />;
    }

    if (source.includes('FloatingParticles')) {
      return () => null;
    }

    return () => null;
  },
}));
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/test-store'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
    cart: [],
    items: [],
    addToCart: vi.fn(),
    totalItems: 0,
  })),
}));
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({ merchant: { id: 'm-1', slug: 'test' } })),
}));
vi.mock('../data/products', () => ({ products: [] }));
vi.mock('../providers/v2-saved-context', () => ({
  useV2Saved: vi.fn(() => ({
    savedIds: new Set(),
    toggleSaved: vi.fn(),
    isSaved: vi.fn(() => false),
  })),
}));
vi.mock('./AdUnit', () => ({
  AdUnit: () => <div data-testid="ad-unit" />,
}));
vi.mock('./ProductGridItem', () => ({
  ProductGridItem: ({ product }: { product: { name: string } }) => (
    <article>{product.name}</article>
  ),
}));

import { afterEach } from 'vitest';
import { prioritizeSmartphoneProducts } from '@baci/shared';
import { useSearchParams } from 'next/navigation';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { EngineProductGrid } from './EngineProductGrid';

afterEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams() as ReturnType<typeof useSearchParams>
  );
  vi.mocked(useMerchantSafe).mockReturnValue({
    merchant: { id: 'm-1', slug: 'test' },
    basePath: '/test-store',
  } as ReturnType<typeof useMerchantSafe>);
});

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

  it('initializes category from ?category= URL param when valid', () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('category=Smartphones') as ReturnType<typeof useSearchParams>);

    render(
      <EngineProductGrid
        externalProducts={[
          createTestProduct({ id: 'tv-1', name: 'Samsung TV', category: 'Smart TVs', stock: 2 }),
          createTestProduct({ id: 'phone-1', name: 'iPhone 16', category: 'Smartphones', stock: 4 }),
        ]}
        categories={[{ name: 'Smartphones', slug: 'smartphones' }, { name: 'Smart TVs', slug: 'smart-tvs' }]}
      />
    );

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(1);
    expect(articles[0].textContent).toBe('iPhone 16');
  });

  it('ignores unknown ?category= URL param and shows all products', () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('category=Unknown') as ReturnType<typeof useSearchParams>);

    render(
      <EngineProductGrid
        externalProducts={[
          createTestProduct({ id: 'tv-1', name: 'Samsung TV', category: 'Smart TVs', stock: 2 }),
          createTestProduct({ id: 'phone-1', name: 'iPhone 16', category: 'Smartphones', stock: 4 }),
        ]}
        categories={[{ name: 'Smartphones', slug: 'smartphones' }, { name: 'Smart TVs', slug: 'smart-tvs' }]}
      />
    );

    expect(screen.getAllByRole('article')).toHaveLength(2);
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
      screen.getByRole('link', { name: 'View all products' })
    ).toHaveAttribute('data-prefetch', 'false');
    expect(
      screen.getByRole('link', { name: 'View all products' }).className
    ).toContain('text-white/70');
    expect(
      screen.getByRole('link', { name: 'View all products' }).className
    ).toContain('hover:text-white');
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

  it('respects a reduced initialDisplayCount for home merchandising', () => {
    render(
      <EngineProductGrid
        externalProducts={Array.from({ length: 13 }, (_, index) =>
          createTestProduct({
            id: `product-${index + 1}`,
            name: `Product ${index + 1}`,
            stock: index + 1,
          })
        )}
        categories={[]}
        initialDisplayCount={12}
      />
    );

    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.queryByText('Product 13')).not.toBeInTheDocument();
  });

  it('supports later inline ad breakpoints for the homepage feed', () => {
    render(
      <EngineProductGrid
        externalProducts={Array.from({ length: 12 }, (_, index) =>
          createTestProduct({
            id: `product-${index + 1}`,
            name: `Product ${index + 1}`,
            stock: index + 1,
          })
        )}
        categories={[]}
        initialDisplayCount={12}
        inlineAdBreakpoints={[12, 24]}
      />
    );

    expect(screen.getAllByTestId('ad-unit')).toHaveLength(1);
  });
});
