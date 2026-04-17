import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { ProductCatalogTable } from './product-catalog-table';

vi.mock('./product-catalog-row', () => ({
  ProductCatalogRow: ({ product }: { product: Product }) => (
    <tr>
      <td>{product.name}</td>
    </tr>
  ),
}));

function createProps(
  overrides: Partial<React.ComponentProps<typeof ProductCatalogTable>> = {}
) {
  return {
    products: [],
    expandedProducts: new Set<string>(),
    dirtyProducts: new Set<string>(),
    isLoading: false,
    isSaving: false,
    jumiaLoading: false,
    jumiaIntegrationId: 'integration-1',
    jumiaIntegrations: [],
    onToggleProduct: vi.fn(),
    onPriceChange: vi.fn(),
    onStockChange: vi.fn(),
    onEditProduct: vi.fn(),
    onExportProduct: vi.fn(),
    onSelectJumiaIntegration: vi.fn(),
    currencySymbol: '₦',
    locale: 'en-NG',
    formatCurrency: vi.fn((amount: number) => `₦${amount}`),
    ...overrides,
  };
}

describe('ProductCatalogTable', () => {
  it('renders only the loader during the initial loading state', () => {
    render(<ProductCatalogTable {...createProps({ isLoading: true })} />);

    expect(screen.getByText('Loading catalog...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders the empty state when loading is complete and no products exist', () => {
    render(<ProductCatalogTable {...createProps()} />);

    expect(screen.getByText('No products found')).toBeInTheDocument();
  });

  it('renders product rows when products are available', () => {
    render(
      <ProductCatalogTable
        {...createProps({
          products: [
            {
              id: 'product-1',
              name: 'PlayStation 5',
              description: 'Console',
              status: 'active',
              price: 1000,
              manage_stock: true,
              stock: 5,
              image: '/product.png',
              imageLarge: '/product-large.png',
              imageHint: 'console',
              brand: 'Sony',
              gtin: '1234567890123',
              mpn: 'PS5-001',
            },
          ],
        })}
      />
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('PlayStation 5')).toBeInTheDocument();
  });
});
