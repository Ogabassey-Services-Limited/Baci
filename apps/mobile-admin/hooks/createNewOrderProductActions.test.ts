import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCustomItemDraft } from '@/components/orders/new-order.defaults';
import type {
  OrderItem,
  SelectableOrderProduct,
} from '@/components/orders/new-order.types';
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
    const setOrderItems = vi.fn(
      (updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
        orderItems =
          typeof updater === 'function' ? updater(orderItems) : updater;
      }
    );
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

  it('handleAddCustomItem adds a custom item when name and price are valid', () => {
    let orderItems: OrderItem[] = [];
    const setOrderItems = vi.fn(
      (updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
        orderItems =
          typeof updater === 'function' ? updater(orderItems) : updater;
      }
    );
    const setCustomItem = vi.fn();
    const setShowCustomItemModal = vi.fn();

    const actions = createNewOrderProductActions({
      customItem: { name: 'Custom Widget', price: '1500' },
      orderItems: [],
      selectedParentProduct: null,
      setCustomItem,
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal,
      setShowProductModal: vi.fn(),
    });

    actions.handleAddCustomItem();

    expect(orderItems).toHaveLength(1);
    expect(orderItems[0]).toMatchObject({
      name: 'Custom Widget',
      price: 1500,
      quantity: 1,
      is_custom: true,
    });
    expect(setShowCustomItemModal).toHaveBeenCalledWith(false);
    expect(setCustomItem).toHaveBeenCalled();
  });

  it('handleAddCustomItem does not add an item when name is empty', () => {
    const setOrderItems = vi.fn();

    const actions = createNewOrderProductActions({
      customItem: { name: '   ', price: '1500' },
      orderItems: [],
      selectedParentProduct: null,
      setCustomItem: vi.fn(),
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal: vi.fn(),
      setShowProductModal: vi.fn(),
    });

    actions.handleAddCustomItem();

    expect(setOrderItems).not.toHaveBeenCalled();
  });

  it('handleAddCustomItem does not add an item when price is not a number', () => {
    const setOrderItems = vi.fn();

    const actions = createNewOrderProductActions({
      customItem: { name: 'Widget', price: 'abc' },
      orderItems: [],
      selectedParentProduct: null,
      setCustomItem: vi.fn(),
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal: vi.fn(),
      setShowProductModal: vi.fn(),
    });

    actions.handleAddCustomItem();

    expect(setOrderItems).not.toHaveBeenCalled();
  });

  it('handleQuantityChange increases quantity by 1', () => {
    const initial: OrderItem[] = [
      {
        id: 'item-1',
        is_custom: false,
        name: 'Phone',
        price: 10000,
        product_id: 'product-1',
        quantity: 2,
        variant_id: null,
        variant_name: null,
      },
    ];
    let orderItems: OrderItem[] = [...initial];
    const setOrderItems = vi.fn(
      (updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
        orderItems =
          typeof updater === 'function' ? updater(orderItems) : updater;
      }
    );

    const actions = createNewOrderProductActions({
      customItem: createEmptyCustomItemDraft(),
      orderItems,
      selectedParentProduct: null,
      setCustomItem: vi.fn(),
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal: vi.fn(),
      setShowProductModal: vi.fn(),
    });

    actions.handleQuantityChange('item-1', 1);

    expect(orderItems[0].quantity).toBe(3);
  });

  it('handleQuantityChange removes the item when quantity reaches zero', () => {
    const initial: OrderItem[] = [
      {
        id: 'item-1',
        is_custom: false,
        name: 'Phone',
        price: 10000,
        product_id: 'product-1',
        quantity: 1,
        variant_id: null,
        variant_name: null,
      },
    ];
    let orderItems: OrderItem[] = [...initial];
    const setOrderItems = vi.fn(
      (updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
        orderItems =
          typeof updater === 'function' ? updater(orderItems) : updater;
      }
    );

    const actions = createNewOrderProductActions({
      customItem: createEmptyCustomItemDraft(),
      orderItems,
      selectedParentProduct: null,
      setCustomItem: vi.fn(),
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal: vi.fn(),
      setShowProductModal: vi.fn(),
    });

    actions.handleQuantityChange('item-1', -1);

    expect(orderItems).toHaveLength(0);
  });
});
