import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { ProductsPageDialogs } from './products-page-dialogs';

vi.mock('@/app/dashboard/products/add/add-product-form', () => ({
  default: ({
    initialData,
  }: {
    initialData?: Product | null;
    onProductAdded: (product: Product) => Promise<void>;
    onCancel: () => void;
  }) => (
    <div data-testid="add-product-form">
      {initialData ? initialData.name : 'new-product'}
    </div>
  ),
}));

vi.mock('@/components/products/csv-bulk-import-dialog', () => ({
  CSVBulkImportDialog: () => null,
}));

vi.mock('@/components/products/google-sheet-import-dialog', () => ({
  GoogleSheetImportDialog: () => null,
}));

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
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
    migration_status: 'pending',
    ...overrides,
  };
}

describe('ProductsPageDialogs', () => {
  it('shows the review-specific dialog copy and notice for needs_review products', () => {
    render(
      <ProductsPageDialogs
        editingProduct={createProduct({ migration_status: 'needs_review' })}
        isAddProductOpen
        isGoogleSheetImportOpen={false}
        isCSVBulkImportOpen={false}
        onAddProductOpenChange={vi.fn()}
        onProductSaved={vi.fn(async () => undefined)}
        onCancelAddProduct={vi.fn()}
        onGoogleSheetImportOpenChange={vi.fn()}
        onGoogleSheetImport={vi.fn()}
        onCsvImportOpenChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Resolve SKU Matrix Review' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This product was flagged during SKU matrix rollout. Review the matrix data, fix any ambiguity, and save to clear the review flag.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Review before saving')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Confirm the default variant, variant conditions, and price/stock values. Saving a valid SKU matrix will clear this review item from the queue.'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-product-form')).toHaveTextContent(
      'PlayStation 5'
    );
  });

  it('shows the standard edit dialog copy for non-review products', () => {
    render(
      <ProductsPageDialogs
        editingProduct={createProduct()}
        isAddProductOpen
        isGoogleSheetImportOpen={false}
        isCSVBulkImportOpen={false}
        onAddProductOpenChange={vi.fn()}
        onProductSaved={vi.fn(async () => undefined)}
        onCancelAddProduct={vi.fn()}
        onGoogleSheetImportOpenChange={vi.fn()}
        onGoogleSheetImport={vi.fn()}
        onCsvImportOpenChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Edit Product' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Update product details below.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Review before saving')).toBeNull();
  });
});
