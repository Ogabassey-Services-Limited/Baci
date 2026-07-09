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

  it('replaces the active edited line when a variant is selected in replacement mode', () => {
    let orderItems: OrderItem[] = [
      {
        details: 'Gift wrap',
        id: 'line-1',
        image_url: 'old.jpg',
        name: 'Samsung Galaxy S22',
        price: 370000,
        product_id: 'product-1',
        quantity: 2,
        variant_attributes: { color: 'Burgundy', storage: '128GB' },
        variant_id: 'variant-old',
        variant_name: 'Burgundy / 128GB',
      },
    ];
    const setOrderItems = vi.fn(
      (updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
        orderItems =
          typeof updater === 'function' ? updater(orderItems) : updater;
      }
    );
    const setVariantReplacementItemId = vi.fn();

    const actions = createNewOrderProductActions({
      customItem: createEmptyCustomItemDraft(),
      orderItems,
      selectedParentProduct: {
        has_variants: true,
        id: 'product-1',
        images: ['parent.jpg'],
        name: 'Samsung Galaxy S22',
        parent_product_id: null,
        price: 370000,
        sku: null,
        variant_attributes: null,
      },
      setCustomItem: vi.fn(),
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal: vi.fn(),
      setShowProductModal: vi.fn(),
      setVariantReplacementItemId,
      variantReplacementItemId: 'line-1',
    });

    actions.handleAddProduct({
      has_variants: false,
      id: 'variant-new',
      images: ['new.jpg'],
      name: 'Samsung Galaxy S22 Phantom Black / 256GB',
      parent_product_id: 'product-1',
      price: 410000,
      sku: 'S22-BLK-256',
      variant_attributes: { color: 'Phantom Black', storage: '256GB' },
    });

    expect(orderItems).toEqual([
      {
        details: 'Gift wrap',
        id: 'product-1::variant-new',
        image_url: 'new.jpg',
        name: 'Samsung Galaxy S22',
        price: 410000,
        product_id: 'product-1',
        quantity: 2,
        variant_attributes: { color: 'Phantom Black', storage: '256GB' },
        variant_id: 'variant-new',
        variant_name: 'Phantom Black / 256GB',
      },
    ]);
    expect(setVariantReplacementItemId).toHaveBeenCalledWith(null);
  });

  it('keeps variant line ids distinct after replacing one variant and adding the old variant again', () => {
    let orderItems: OrderItem[] = [
      {
        id: 'line-1',
        image_url: 'old.jpg',
        name: 'Samsung Galaxy S22',
        price: 370000,
        product_id: 'product-1',
        quantity: 1,
        variant_attributes: { color: 'Burgundy', storage: '128GB' },
        variant_id: 'variant-old',
        variant_name: 'Burgundy / 128GB',
      },
    ];
    const setOrderItems = vi.fn(
      (updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
        orderItems =
          typeof updater === 'function' ? updater(orderItems) : updater;
      }
    );
    const selectedParentProduct = {
      has_variants: true,
      id: 'product-1',
      images: [],
      name: 'Samsung Galaxy S22',
      parent_product_id: null,
      price: 370000,
      sku: null,
      variant_attributes: null,
    };

    createNewOrderProductActions({
      customItem: createEmptyCustomItemDraft(),
      orderItems,
      selectedParentProduct,
      setCustomItem: vi.fn(),
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal: vi.fn(),
      setShowProductModal: vi.fn(),
      setVariantReplacementItemId: vi.fn(),
      variantReplacementItemId: 'line-1',
    }).handleAddProduct({
      has_variants: false,
      id: 'variant-new',
      images: [],
      name: 'Samsung Galaxy S22 Phantom Black / 256GB',
      parent_product_id: 'product-1',
      price: 410000,
      sku: 'S22-BLK-256',
      variant_attributes: { color: 'Phantom Black', storage: '256GB' },
    });

    createNewOrderProductActions({
      customItem: createEmptyCustomItemDraft(),
      orderItems,
      selectedParentProduct,
      setCustomItem: vi.fn(),
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal: vi.fn(),
      setShowProductModal: vi.fn(),
      variantReplacementItemId: null,
    }).handleAddProduct({
      has_variants: false,
      id: 'variant-old',
      images: [],
      name: 'Samsung Galaxy S22 Burgundy / 128GB',
      parent_product_id: 'product-1',
      price: 370000,
      sku: 'S22-BURG-128',
      variant_attributes: { color: 'Burgundy', storage: '128GB' },
    });

    expect(orderItems.map((item) => item.id)).toEqual([
      'product-1::variant-new',
      'product-1::variant-old',
    ]);
    expect(new Set(orderItems.map((item) => item.id)).size).toBe(
      orderItems.length
    );
  });

  it('adds the product normally when the replacement target is stale', () => {
    let orderItems: OrderItem[] = [
      {
        id: 'line-1',
        is_custom: false,
        name: 'Samsung Galaxy S22',
        price: 370000,
        product_id: 'product-1',
        quantity: 1,
        variant_id: 'variant-old',
        variant_name: 'Burgundy / 128GB',
      },
    ];
    const setOrderItems = vi.fn(
      (updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
        orderItems =
          typeof updater === 'function' ? updater(orderItems) : updater;
      }
    );
    const setVariantReplacementItemId = vi.fn();

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
      setVariantReplacementItemId,
      variantReplacementItemId: 'missing-line',
    });

    actions.handleAddProduct({
      has_variants: false,
      id: 'product-2',
      images: [],
      name: 'Xiaomi 13T',
      parent_product_id: null,
      price: 360000,
      sku: 'XIAOMI-13T',
      variant_attributes: null,
    });

    expect(orderItems).toHaveLength(2);
    expect(orderItems[1]).toMatchObject({
      name: 'Xiaomi 13T',
      price: 360000,
      product_id: 'product-2',
      quantity: 1,
    });
    expect(setVariantReplacementItemId).toHaveBeenCalledWith(null);
  });

  it('merges into an existing variant line when replacing another line with the same variant', () => {
    let orderItems: OrderItem[] = [
      {
        id: 'line-1',
        name: 'Samsung Galaxy S22',
        price: 370000,
        product_id: 'product-1',
        quantity: 2,
        variant_id: 'variant-old',
        variant_name: 'Burgundy / 128GB',
      },
      {
        id: 'line-2',
        name: 'Samsung Galaxy S22',
        price: 410000,
        product_id: 'product-1',
        quantity: 1,
        variant_id: 'variant-new',
        variant_name: 'Phantom Black / 256GB',
      },
    ];
    const setOrderItems = vi.fn(
      (updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
        orderItems =
          typeof updater === 'function' ? updater(orderItems) : updater;
      }
    );
    const setVariantReplacementItemId = vi.fn();

    const actions = createNewOrderProductActions({
      customItem: createEmptyCustomItemDraft(),
      orderItems,
      selectedParentProduct: {
        has_variants: true,
        id: 'product-1',
        images: [],
        name: 'Samsung Galaxy S22',
        parent_product_id: null,
        price: 370000,
        sku: null,
        variant_attributes: null,
      },
      setCustomItem: vi.fn(),
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal: vi.fn(),
      setShowProductModal: vi.fn(),
      setVariantReplacementItemId,
      variantReplacementItemId: 'line-1',
    });

    actions.handleAddProduct({
      has_variants: false,
      id: 'variant-new',
      images: [],
      name: 'Samsung Galaxy S22 Phantom Black / 256GB',
      parent_product_id: 'product-1',
      price: 410000,
      sku: 'S22-BLK-256',
      variant_attributes: { color: 'Phantom Black', storage: '256GB' },
    });

    expect(orderItems).toHaveLength(1);
    expect(orderItems[0]).toMatchObject({
      id: 'line-2',
      product_id: 'product-1',
      quantity: 3,
      variant_id: 'variant-new',
    });
    expect(setVariantReplacementItemId).toHaveBeenCalledWith(null);
  });

  it('treats quick-add matches as new items even if a replacement id is stale', () => {
    let orderItems: OrderItem[] = [
      {
        id: 'line-1',
        name: 'Samsung Galaxy S22',
        price: 370000,
        product_id: 'product-1',
        quantity: 1,
        variant_id: 'variant-old',
        variant_name: 'Burgundy / 128GB',
      },
    ];
    const setOrderItems = vi.fn(
      (updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
        orderItems =
          typeof updater === 'function' ? updater(orderItems) : updater;
      }
    );
    const setVariantReplacementItemId = vi.fn();

    const actions = createNewOrderProductActions({
      customItem: { name: 'Xiaomi 13T', price: '360000' },
      orderItems,
      selectedParentProduct: null,
      setCustomItem: vi.fn(),
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal: vi.fn(),
      setShowProductModal: vi.fn(),
      setVariantReplacementItemId,
      variantReplacementItemId: 'line-1',
    });

    actions.handleUseQuickAddProductMatch({
      has_variants: false,
      id: 'product-2',
      images: [],
      name: 'Xiaomi 13T',
      parent_product_id: null,
      price: 360000,
      sku: 'XIAOMI-13T',
      variant_attributes: null,
    });

    expect(orderItems).toHaveLength(2);
    expect(orderItems[0]).toMatchObject({
      id: 'line-1',
      variant_id: 'variant-old',
    });
    expect(orderItems[1]).toMatchObject({
      product_id: 'product-2',
      quantity: 1,
    });
    expect(setVariantReplacementItemId).toHaveBeenCalledWith(null);
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
      product_match_status: 'custom',
    });
    expect(setShowCustomItemModal).toHaveBeenCalledWith(false);
    expect(setCustomItem).toHaveBeenCalled();
  });

  it('uses a quick-add product match and closes the custom item modal', () => {
    let orderItems: OrderItem[] = [];
    const setOrderItems = vi.fn(
      (updater: OrderItem[] | ((previous: OrderItem[]) => OrderItem[])) => {
        orderItems =
          typeof updater === 'function' ? updater(orderItems) : updater;
      }
    );
    const setCustomItem = vi.fn();
    const setShowCustomItemModal = vi.fn();
    const setShowProductModal = vi.fn();
    const product: SelectableOrderProduct = {
      has_variants: false,
      id: 'product-1',
      images: [],
      name: 'Existing Product',
      parent_product_id: null,
      price: 1500,
      sku: null,
      variant_attributes: null,
    };

    const actions = createNewOrderProductActions({
      customItem: { name: 'Existing Product', price: '1500' },
      orderItems: [],
      selectedParentProduct: null,
      setCustomItem,
      setOrderItems,
      setProductSearch: vi.fn(),
      setSelectedParentProduct: vi.fn(),
      setShowCustomItemModal,
      setShowProductModal,
    });

    actions.handleUseQuickAddProductMatch(product);

    expect(orderItems).toHaveLength(1);
    expect(orderItems[0]).toMatchObject({
      id: 'product-1::base',
      name: 'Existing Product',
      product_id: 'product-1',
      quantity: 1,
    });
    expect(setCustomItem).toHaveBeenCalledWith(createEmptyCustomItemDraft());
    expect(setShowCustomItemModal).toHaveBeenCalledWith(false);
    expect(setShowProductModal).not.toHaveBeenCalled();
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
