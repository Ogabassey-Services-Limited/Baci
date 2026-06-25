import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { ProductCatalog } from './product-catalog';
import type { SaveDirtyProductsResult } from './save-dirty-products';

interface ProductCatalogTableMockProps {
  products: Product[];
  isSaving: boolean;
  onPriceChange: (productId: string, newPrice: string) => void;
}

interface SaveDirtyProductsOptionsForTest {
  dirtyProductIds: Iterable<string>;
  dirtyProductSnapshots?: ReadonlyMap<string, Product>;
  localProducts: Product[];
  updateProduct: (product: Product) => Promise<unknown>;
}

const mocks = vi.hoisted(() => ({
  saveDirtyProducts: vi.fn(),
  setJumiaIntegrationId: vi.fn(),
  setPage: vi.fn(),
  toast: vi.fn(),
  updateProduct: vi.fn(),
  useProductContext: vi.fn(),
}));

vi.mock('@/contexts/product-context', () => ({
  useProductContext: mocks.useProductContext,
}));

vi.mock('@/hooks/use-debounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({ merchant: { country: 'NG', id: 'merchant-1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('./jumia/export-dialog', () => ({
  ExportToJumiaDialog: () => null,
}));

vi.mock('./product-catalog-table', () => ({
  ProductCatalogTable: ({
    products,
    isSaving,
    onPriceChange,
  }: ProductCatalogTableMockProps) => {
    const product = products[0];
    const secondProduct = products[1];

    if (!product) {
      return <div>No products</div>;
    }

    return (
      <div>
        <output aria-label="current price">{product.price}</output>
        <output aria-label="save status">{isSaving ? 'saving' : 'idle'}</output>
        <button type="button" onClick={() => onPriceChange(product.id, '200')}>
          Set price 200
        </button>
        <button type="button" onClick={() => onPriceChange(product.id, '300')}>
          Set price 300
        </button>
        {secondProduct ? (
          <button
            type="button"
            onClick={() => {
              onPriceChange(product.id, '200');
              onPriceChange(secondProduct.id, '400');
            }}
          >
            Set both prices
          </button>
        ) : null}
      </div>
    );
  },
}));

vi.mock('./save-dirty-products', () => ({
  saveDirtyProducts: mocks.saveDirtyProducts,
}));

vi.mock('./use-jumia-integrations', () => ({
  useJumiaIntegrations: () => ({
    jumiaIntegrationId: null,
    jumiaIntegrations: [],
    jumiaLoading: false,
    setJumiaIntegrationId: mocks.setJumiaIntegrationId,
  }),
}));

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    name: 'Test Product',
    description: '',
    price: 100,
    manage_stock: true,
    stock: 5,
    minimum_order_quantity: 1,
    status: 'active',
    image: '',
    imageLarge: '',
    imageHint: 'test product',
    brand: 'Baci',
    gtin: '1234567890123',
    mpn: 'TEST-PRODUCT',
    ...overrides,
  };
}

function createDeferredSave() {
  let resolve!: (value: SaveDirtyProductsResult) => void;
  const promise = new Promise<SaveDirtyProductsResult>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

function fulfilledProductSave(
  productId = 'product-1'
): SaveDirtyProductsResult {
  return {
    failedIds: [],
    fulfilledIds: [productId],
    skippedIds: [],
  };
}

function failedProductSave(productId = 'product-1'): SaveDirtyProductsResult {
  return {
    failedIds: [productId],
    fulfilledIds: [],
    skippedIds: [],
  };
}

function getSaveCall(index: number): SaveDirtyProductsOptionsForTest {
  const call = mocks.saveDirtyProducts.mock.calls[index]?.[0];
  if (!call) {
    throw new Error(`Missing saveDirtyProducts call at index ${index}`);
  }

  return call as SaveDirtyProductsOptionsForTest;
}

describe('ProductCatalog', () => {
  beforeEach(() => {
    mocks.saveDirtyProducts.mockReset();
    mocks.setJumiaIntegrationId.mockReset();
    mocks.setPage.mockReset();
    mocks.toast.mockReset();
    mocks.updateProduct.mockReset();
    mocks.useProductContext.mockReset();
    mocks.updateProduct.mockResolvedValue(undefined);
    mocks.useProductContext.mockReturnValue({
      isLoading: false,
      pagination: { limit: 20, page: 1, total: 1, totalPages: 1 },
      products: [buildProduct()],
      setPage: mocks.setPage,
      updateProduct: mocks.updateProduct,
    });
  });

  it('queues a follow-up autosave when edits land while a save is in flight', async () => {
    const user = userEvent.setup();
    const firstSave = createDeferredSave();
    mocks.saveDirtyProducts
      .mockReturnValueOnce(firstSave.promise)
      .mockResolvedValueOnce(fulfilledProductSave());

    render(<ProductCatalog statusFilter="all" stockFilter="all" />);

    await user.click(screen.getByRole('button', { name: /set price 200/i }));

    await waitFor(() => {
      expect(mocks.saveDirtyProducts).toHaveBeenCalledTimes(1);
    });
    expect(getSaveCall(0).dirtyProductSnapshots?.get('product-1')?.price).toBe(
      200
    );

    await user.click(screen.getByRole('button', { name: /set price 300/i }));
    expect(screen.getByLabelText(/current price/i)).toHaveTextContent('300');

    firstSave.resolve(fulfilledProductSave());

    await waitFor(() => {
      expect(mocks.saveDirtyProducts).toHaveBeenCalledTimes(2);
    });
    expect(getSaveCall(1).dirtyProductSnapshots?.get('product-1')?.price).toBe(
      300
    );

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Changes Saved' })
      );
    });
  });

  it('shows a destructive toast when an autosave fails', async () => {
    const user = userEvent.setup();
    mocks.saveDirtyProducts.mockResolvedValueOnce(failedProductSave());

    render(<ProductCatalog statusFilter="all" stockFilter="all" />);

    await user.click(screen.getByRole('button', { name: /set price 200/i }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Save Failed',
          variant: 'destructive',
        })
      );
    });
  });

  it('shows a destructive toast when a queued follow-up autosave fails', async () => {
    const user = userEvent.setup();
    const firstSave = createDeferredSave();
    mocks.saveDirtyProducts
      .mockReturnValueOnce(firstSave.promise)
      .mockResolvedValueOnce(failedProductSave());

    render(<ProductCatalog statusFilter="all" stockFilter="all" />);

    await user.click(screen.getByRole('button', { name: /set price 200/i }));

    await waitFor(() => {
      expect(mocks.saveDirtyProducts).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: /set price 300/i }));
    firstSave.resolve(fulfilledProductSave());

    await waitFor(() => {
      expect(mocks.saveDirtyProducts).toHaveBeenCalledTimes(2);
    });
    expect(getSaveCall(1).dirtyProductSnapshots?.get('product-1')?.price).toBe(
      300
    );
    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Save Failed',
          variant: 'destructive',
        })
      );
    });
  });

  it('shows a partial-save toast when one autosave batch has mixed outcomes', async () => {
    const user = userEvent.setup();
    mocks.useProductContext.mockReturnValue({
      isLoading: false,
      pagination: { limit: 20, page: 1, total: 2, totalPages: 1 },
      products: [
        buildProduct(),
        buildProduct({ id: 'product-2', name: 'Second Product', price: 150 }),
      ],
      setPage: mocks.setPage,
      updateProduct: mocks.updateProduct,
    });
    mocks.saveDirtyProducts
      .mockResolvedValueOnce({
        failedIds: ['product-2'],
        fulfilledIds: ['product-1'],
        skippedIds: [],
      })
      .mockResolvedValue(failedProductSave('product-2'));

    render(<ProductCatalog statusFilter="all" stockFilter="all" />);

    await user.click(screen.getByRole('button', { name: /set both prices/i }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Partial Save',
          variant: 'destructive',
        })
      );
    });
  });
});
