import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { ProductCatalogRowActions } from './product-catalog-row-actions';

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

function openMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: /open menu/i }), {
    button: 0,
    ctrlKey: false,
  });
}

describe('ProductCatalogRowActions', () => {
  it('shows Resolve Review when the product needs review and calls edit', async () => {
    const onEditProduct = vi.fn();

    render(
      <ProductCatalogRowActions
        product={createProduct({ migration_status: 'needs_review' })}
        jumiaLoading={false}
        jumiaIntegrationId="integration-1"
        jumiaIntegrations={[]}
        onEditProduct={onEditProduct}
        onExportProduct={vi.fn()}
        onSelectJumiaIntegration={vi.fn()}
      />
    );
    openMenu();
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Resolve Review' })
    );

    expect(onEditProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-1' })
    );
  });

  it('shows the Jumia shop selection list when multiple integrations exist', async () => {
    const onSelectJumiaIntegration = vi.fn();

    render(
      <ProductCatalogRowActions
        product={createProduct()}
        jumiaLoading={false}
        jumiaIntegrationId={null}
        jumiaIntegrations={[
          { id: 'integration-1', shop_name: 'Shop One' },
          { id: 'integration-2', shop_name: 'Shop Two' },
        ]}
        onEditProduct={vi.fn()}
        onExportProduct={vi.fn()}
        onSelectJumiaIntegration={onSelectJumiaIntegration}
      />
    );
    openMenu();
    expect(await screen.findByText('Select Jumia Shop')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Shop Two' }));

    expect(onSelectJumiaIntegration).toHaveBeenCalledWith(
      'integration-2',
      expect.objectContaining({ id: 'product-1' })
    );
  });

  it('disables export when no integration is selected and hides edit when no edit handler exists', async () => {
    render(
      <ProductCatalogRowActions
        product={createProduct()}
        jumiaLoading={true}
        jumiaIntegrationId={null}
        jumiaIntegrations={[]}
        onExportProduct={vi.fn()}
        onSelectJumiaIntegration={vi.fn()}
      />
    );
    openMenu();

    expect(screen.queryByText('Edit Product')).toBeNull();
    const exportMenuItem = await screen.findByRole('menuitem', {
      name: 'Export to Jumia',
    });

    expect(exportMenuItem).toHaveAttribute('data-disabled', '');
    expect(exportMenuItem).toHaveAttribute(
      'title',
      'Jumia integration required'
    );
  });
});
