import type { Product } from '@/lib/products';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@baci/shared', () => ({
  prioritizeSmartphoneProducts: vi.fn(
    (products: unknown[]) => products
  ),
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/test-store'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
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
vi.mock('./AdUnit', () => ({ AdUnit: () => null }));
let mockAdvancedProductFilterProps: {
  onSelectCondition: (condition: string) => void;
} | null = null;
vi.mock('./AdvancedProductFilters', () => ({
  AdvancedProductFilters: (props: {
    onSelectCondition: (condition: string) => void;
  }) => {
    mockAdvancedProductFilterProps = {
      onSelectCondition: props.onSelectCondition,
    };
    return null;
  },
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
import { useSearchParams } from 'next/navigation';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { EngineProductGrid } from './EngineProductGrid';

beforeEach(() => {
  mockAdvancedProductFilterProps = null;
});

afterEach(() => {
  vi.resetAllMocks();
  mockAdvancedProductFilterProps = null;
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

  it('matches condition filters against available_conditions for mixed-condition families', async () => {
    render(
      <EngineProductGrid
        externalProducts={[
          createTestProduct({
            id: 'family-1',
            name: 'Galaxy S24 Family',
            category: 'Smartphones',
            stock: 4,
            condition: 'new',
            available_conditions: ['new', 'used'],
          }),
          createTestProduct({
            id: 'family-2',
            name: 'iPhone 16 New',
            category: 'Smartphones',
            stock: 3,
            condition: 'new',
            available_conditions: ['new'],
          }),
        ]}
        categories={[{ name: 'Smartphones', slug: 'smartphones' }]}
      />
    );

    expect(screen.getAllByRole('article')).toHaveLength(2);

    await act(async () => {
      mockAdvancedProductFilterProps?.onSelectCondition('Used');
    });

    await waitFor(() => {
      const articles = screen.getAllByRole('article');
      expect(articles).toHaveLength(1);
      expect(articles[0].textContent).toBe('Galaxy S24 Family');
    });
  });

  it('keeps legacy condition-offer families visible when filtering by new or used', async () => {
    render(
      <EngineProductGrid
        externalProducts={[
          createTestProduct({
            id: 'family-1',
            name: 'PlayStation 5 Family',
            category: 'Consoles',
            stock: 2,
            condition: 'new',
            has_condition_offers: true,
            available_conditions: [],
          }),
          createTestProduct({
            id: 'family-2',
            name: 'Nintendo Switch',
            category: 'Consoles',
            stock: 2,
            condition: 'new',
            available_conditions: ['new'],
          }),
        ]}
        categories={[{ name: 'Consoles', slug: 'consoles' }]}
      />
    );

    await waitFor(() => {
      expect(mockAdvancedProductFilterProps).not.toBeNull();
    });

    await act(async () => {
      mockAdvancedProductFilterProps?.onSelectCondition('Used');
    });

    await waitFor(() => {
      expect(screen.getAllByRole('article').map((item) => item.textContent)).toEqual([
        'PlayStation 5 Family',
      ]);
    });
  });
});
