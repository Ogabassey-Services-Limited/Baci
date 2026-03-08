import type { Product } from '@/lib/products';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
vi.mock('./AdvancedProductFilters', () => ({
  AdvancedProductFilters: () => null,
}));
vi.mock('./FloatingParticles', () => ({
  FloatingParticles: () => null,
}));
vi.mock('./ProductGridItem', () => ({
  ProductGridItem: ({ product }: { product: { name: string } }) => (
    <div data-testid="grid-item">{product.name}</div>
  ),
}));
vi.mock('./ProductListItem', () => ({
  ProductListItem: () => <div data-testid="list-item" />,
}));

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

  it('prioritizes smartphone products when All is selected', () => {
    const { getAllByTestId } = render(
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

    // EngineProductGrid reorders the All view so smartphone categories render before other categories.
    expect(getAllByTestId('grid-item').map((item) => item.textContent)).toEqual(
      ['iPhone 16', 'Samsung TV']
    );
  });
});
