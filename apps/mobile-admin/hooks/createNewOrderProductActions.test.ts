import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCustomItemDraft } from '@/components/orders/new-order.defaults';
import type { OrderItem, SelectableOrderProduct } from '@/components/orders/new-order.types';
import { createNewOrderProductActions } from '@/hooks/createNewOrderProductActions';

vi.mock('expo-crypto', () => ({
  randomUUID: () => 'uuid-123456',
}));

describe('createNewOrderProductActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a non-variant product directly to the order and closes the picker', () => {
    let orderItems: OrderItem[] = [];
    const setOrderItems = vi.fn((updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
      orderItems = typeof updater === 'function' ? updater(orderItems) : updater;
    });
    const setShowProductModal = vi.fn();
    const setProductSearch = vi.fn();
    const setSelectedParentProduct = vi.fn();

    const product: SelectableOrderProduct = {
      has_variants: false,
      id: 'product-1',
      images: [],
      name: 'Baci Phone',
      parent_product_id: null,
      price: 25000,
      sku: 'SKU-1',
      variant_attributes: [],
    };

    const actions = createNewOrderProductActions({
      customItem: createEmptyCustomItemDraft(),
      orderItems: [],
      selectedParentProduct: null,
      setCustomItem: vi.fn(),
      setOrderItems,
      setProductSearch,
      setSelectedParentProduct,
      setShowCustomItemModal: vi.fn(),
      setShowProductModal,
    });

    actions.handleSelectProduct(product);

    expect(orderItems).toHaveLength(1);
    expect(orderItems[0]).toMatchObject({
      id: 'product-1::base',
      name: 'Baci Phone',
      price: 25000,
      quantity: 1,
    });
    expect(setShowProductModal).toHaveBeenCalledWith(false);
    expect(setProductSearch).toHaveBeenCalledWith('');
    expect(setSelectedParentProduct).toHaveBeenCalledWith(null);
  });

  it('opens the variant picker when the product has variants', () => {
    const setSelectedParentProduct = vi.fn();
    const actions = createNewOrderProductActions({
      customItem: createEmptyCustomItemDraft(),
      orderItems: [],
      selectedParentProduct: null,
      setCustomItem: vi.fn(),
      setOrderItems: vi.fn(),
      setProductSearch: vi.fn(),
      setSelectedParentProduct,
      setShowCustomItemModal: vi.fn(),
      setShowProductModal: vi.fn(),
    });

    const variantProduct: SelectableOrderProduct = {
      has_variants: true,
      id: 'product-1',
      images: ['https://example.com/image.png'],
      name: 'Baci Phone',
      parent_product_id: null,
      price: 25000,
      sku: 'SKU-1',
      variant_attributes: [],
    };

    actions.handleSelectProduct(variantProduct);

    expect(setSelectedParentProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-1' })
    );
  });
});
