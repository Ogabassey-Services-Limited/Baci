import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductProvider, useProductContext } from '@/contexts/product-context';
import type { Product } from '@/lib/products';
import type { ProductsResult } from '@/lib/products-server';

vi.mock('./auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    loading: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/api-client', () => ({
  apiDelete: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

const productFixture: Product = {
  id: 'product-1',
  name: 'PlayStation 5',
  description: 'Console',
  status: 'active',
  price: 500000,
  manage_stock: true,
  stock: 4,
  image: '/ps5.jpg',
  imageLarge: '/ps5-large.jpg',
  imageHint: '',
  brand: 'Sony',
  gtin: '',
  mpn: '',
};

const initialDataFixture: ProductsResult = {
  products: [productFixture],
  filters: {
    migration: 'needs_review',
    status: 'draft',
    stock: 'out_of_stock',
    search: 'ps5',
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
  stats: {
    inventoryValue: 500000,
    outOfStockCount: 0,
    categoryCount: 1,
  },
};

function ProductContextProbe() {
  const { migrationFilter, statusFilter, stockFilter, searchTerm } =
    useProductContext();

  return (
    <div>
      <span>{migrationFilter}</span>
      <span>{statusFilter}</span>
      <span>{stockFilter}</span>
      <span>{searchTerm}</span>
    </div>
  );
}

describe('ProductProvider', () => {
  it('hydrates filter state from server data', () => {
    render(
      <ProductProvider initialData={initialDataFixture}>
        <ProductContextProbe />
      </ProductProvider>
    );

    expect(screen.getByText('needs_review')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('out_of_stock')).toBeInTheDocument();
    expect(screen.getByText('ps5')).toBeInTheDocument();
  });

  it('throws when the hook is used outside the provider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => render(<ProductContextProbe />)).toThrow(
      'useProductContext must be used within a ProductProvider'
    );

    consoleError.mockRestore();
  });
});
