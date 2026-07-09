import { describe, expect, it, vi } from 'vitest';
import type {
  OrderItem,
  SelectableOrderProduct,
} from '@/components/orders/new-order.types';
import type { Product } from './useProducts';
import {
  createChangeEditingItemVariantHandler,
  getSelectableProductRows,
} from './useNewOrderControllerActions';

describe('createChangeEditingItemVariantHandler', () => {
  it('opens the variant picker for the current editable variant line', () => {
    const editingItem: OrderItem = {
      condition: 'open_box',
      id: 'line-1',
      image_url: 'image.jpg',
      is_custom: false,
      name: 'Samsung Galaxy S22',
      price: 370_000,
      product_id: 'product-1',
      quantity: 1,
      variant_attributes: { color: 'Burgundy', storage: '128GB' },
      variant_id: 'variant-1',
      variant_name: 'Burgundy / 128GB',
    };
    const setSelectedParentProduct = vi.fn();
    const setVariantReplacementItemId = vi.fn();
    const setProductSearch = vi.fn();
    const setShowEditItemModal = vi.fn();
    const setShowProductModal = vi.fn();

    const handler = createChangeEditingItemVariantHandler({
      setProductSearch,
      setSelectedParentProduct,
      setVariantReplacementItemId,
      uiState: {
        editingItem,
        setShowEditItemModal,
        setShowProductModal,
      },
    });

    handler();

    expect(setVariantReplacementItemId).toHaveBeenCalledWith('line-1');
    expect(setSelectedParentProduct).toHaveBeenCalledWith({
      condition: 'open_box',
      has_variants: true,
      id: 'product-1',
      images: ['image.jpg'],
      name: 'Samsung Galaxy S22',
      parent_product_id: null,
      price: 370_000,
      sku: null,
      variant_attributes: { color: 'Burgundy', storage: '128GB' },
    });
    expect(setProductSearch).toHaveBeenCalledWith('');
    expect(setShowEditItemModal).toHaveBeenCalledWith(false);
    expect(setShowProductModal).toHaveBeenCalledWith(true);
  });

  it('does not open the picker for custom or non-variant lines', () => {
    const setSelectedParentProduct = vi.fn();
    const handler = createChangeEditingItemVariantHandler({
      setProductSearch: vi.fn(),
      setSelectedParentProduct,
      setVariantReplacementItemId: vi.fn(),
      uiState: {
        editingItem: {
          id: 'line-1',
          is_custom: true,
          name: 'Custom item',
          price: 10_000,
          product_id: null,
          quantity: 1,
          variant_id: null,
          variant_name: null,
        },
        setShowEditItemModal: vi.fn(),
        setShowProductModal: vi.fn(),
      },
    });

    handler();

    expect(setSelectedParentProduct).not.toHaveBeenCalled();
  });
});

describe('getSelectableProductRows', () => {
  it('returns loaded variants while picking a parent product variant', () => {
    const variants: SelectableOrderProduct[] = [
      {
        has_variants: false,
        id: 'variant-1',
        images: [],
        name: 'Samsung Galaxy S22 Burgundy',
        parent_product_id: 'product-1',
        price: 370_000,
        sku: null,
        variant_attributes: { color: 'Burgundy' },
      },
    ];

    expect(
      getSelectableProductRows({
        filteredProducts: [],
        isPickingVariant: true,
        selectedParentProductVariantsData: variants,
      })
    ).toBe(variants);
  });

  it('normalizes product variant attributes when listing parent products', () => {
    const product = {
      has_variants: false,
      id: 'product-1',
      images: [],
      name: 'Samsung Galaxy S22',
      parent_product_id: null,
      price: 370_000,
      sku: null,
      variant_attributes: [{ key: 'Color', value: 'Burgundy' }],
    } as unknown as Product;

    const rows = getSelectableProductRows({
      filteredProducts: [product],
      isPickingVariant: false,
    });

    expect(rows[0]?.variant_attributes).toEqual({ Color: 'Burgundy' });
  });
});
