import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';

vi.mock('@/lib/routes', () => ({ asRoute: (p: string) => p }));
vi.mock('../components/AdUnit', () => ({ AdUnit: () => null }));
vi.mock('../components/CategoryFiltersSidebar', () => ({
  CategoryFiltersSidebar: () => <div aria-label="Filters sidebar" />,
}));
vi.mock('../components/ProductCard', () => ({
  ProductCard: ({
    product,
    onAddToCart,
  }: {
    product: { name: string };
    onAddToCart?: (event: React.MouseEvent, product: unknown) => void;
  }) => (
    <article aria-label={product.name}>
      <button type="button" onClick={(event) => onAddToCart?.(event, product)}>
        Add {product.name}
      </button>
    </article>
  ),
}));
vi.mock('../components/StorefrontPagination', () => ({
  StorefrontPagination: ({ basePath }: { basePath: string }) => (
    <nav aria-label="Pagination">{basePath}</nav>
  ),
}));

import { CategoryPageResults } from './category-page-results';

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    name: 'Phone',
    slug: 'phone',
    description: '',
    price: '₦100',
    rawPrice: 100,
    image: '',
    condition: 'New',
    ...overrides,
  } as Product;
}

function renderResults(
  overrides: Partial<React.ComponentProps<typeof CategoryPageResults>> = {}
) {
  const onAddToCart = vi.fn();
  const onClearFilters = vi.fn();
  const products = [buildProduct({ id: 'a', name: 'Phone A' })];

  render(
    <CategoryPageResults
      canUseClientFilters={true}
      filters={{} as never}
      availableOptions={{} as never}
      onFilterChange={vi.fn()}
      onClearFilters={onClearFilters}
      viewMode="grid"
      visibleProducts={products}
      addedItems={[]}
      onAddToCart={onAddToCart}
      hasKnownProducts={true}
      hasVisibleProducts={true}
      hasActiveFilters={false}
      filteredProductCount={1}
      pageStartIndex={0}
      visibleProductEndIndex={1}
      paginationProductCount={1}
      currentPageNumber={1}
      totalPages={1}
      pageTitle="Smartphones"
      categoryPath="/test-store/smartphones"
      {...overrides}
    />
  );

  return { onAddToCart, onClearFilters };
}

describe('CategoryPageResults', () => {
  it('renders the product grid and forwards add-to-cart clicks', () => {
    const { onAddToCart } = renderResults();

    expect(
      screen.getByRole('article', { name: 'Phone A' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Phone A' }));
    expect(onAddToCart).toHaveBeenCalledTimes(1);
  });

  it('shows the "no products found" empty state and clear action', () => {
    const { onClearFilters } = renderResults({
      hasKnownProducts: false,
      hasVisibleProducts: false,
      visibleProducts: [],
    });

    expect(screen.getByText('No products found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('shows the temporarily-unavailable state when the slice is empty but products exist', () => {
    renderResults({
      hasVisibleProducts: false,
      visibleProducts: [],
      currentPageNumber: 2,
      totalPages: 2,
    });

    expect(
      screen.getByText('Products on this page are temporarily unavailable.')
    ).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('renders the filtered-results message instead of pagination when filters are active', () => {
    renderResults({ hasActiveFilters: true, filteredProductCount: 3 });

    expect(
      screen.getByText(/Filtered results show all 3 matching products/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Pagination' })
    ).not.toBeInTheDocument();
  });

  it('renders pagination with the category path when filters are inactive', () => {
    renderResults();

    expect(
      screen.getByRole('navigation', { name: 'Pagination' })
    ).toHaveTextContent('/test-store/smartphones');
    expect(
      screen.getByText('Showing 1-1 of 1 products')
    ).toBeInTheDocument();
  });
});
