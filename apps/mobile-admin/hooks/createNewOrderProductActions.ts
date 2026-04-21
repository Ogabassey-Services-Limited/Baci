import * as Crypto from 'expo-crypto';
import type { Dispatch, SetStateAction } from 'react';
import { createEmptyCustomItemDraft } from '@/components/orders/new-order.defaults';
import type {
  CustomItemDraft,
  OrderItem,
  SelectableOrderProduct,
} from '@/components/orders/new-order.types';
import type { Product } from '@/hooks/useProducts';
import { buildManualOrderLineItem } from '@/lib/manual-order-line-item';
import { mergeOrderItem } from '@/lib/order-items';

interface CreateNewOrderProductActionsParams {
  customItem: CustomItemDraft;
  orderItems: OrderItem[];
  selectedParentProduct: Product | null;
  setCustomItem: Dispatch<SetStateAction<CustomItemDraft>>;
  setOrderItems: Dispatch<SetStateAction<OrderItem[]>>;
  setProductSearch: Dispatch<SetStateAction<string>>;
  setSelectedParentProduct: Dispatch<SetStateAction<Product | null>>;
  setShowCustomItemModal: Dispatch<SetStateAction<boolean>>;
  setShowProductModal: Dispatch<SetStateAction<boolean>>;
}

export function createNewOrderProductActions({
  customItem,
  selectedParentProduct,
  setCustomItem,
  setOrderItems,
  setProductSearch,
  setSelectedParentProduct,
  setShowCustomItemModal,
  setShowProductModal,
}: CreateNewOrderProductActionsParams) {
  const resetProductPickerState = () => {
    setSelectedParentProduct(null);
  };

  const closeProductModal = () => {
    resetProductPickerState();
    setShowProductModal(false);
    setProductSearch('');
  };

  const handleAddProduct = (product: SelectableOrderProduct) => {
    setOrderItems((previous) =>
      mergeOrderItem(
        previous,
        buildManualOrderLineItem({
          fallbackImageUrl: selectedParentProduct?.images?.[0],
          parentProductName: selectedParentProduct?.name,
          product,
        })
      )
    );
    closeProductModal();
  };

  const handleSelectProduct = (product: SelectableOrderProduct) => {
    if (!product.has_variants) {
      handleAddProduct(product);
      return;
    }

    setSelectedParentProduct(product as Product);
  };

  const handleAddCustomItem = () => {
    const normalizedName = customItem.name.trim().replace(/\s+/g, ' ');
    if (!normalizedName || !customItem.price) {
      return;
    }

    setOrderItems((previous) =>
      mergeOrderItem(previous, {
        id: `custom-${Crypto.randomUUID()}`,
        is_custom: true,
        name: normalizedName,
        price: (() => {
          const parsed = Number.parseFloat(customItem.price);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        })(),
        product_id: null,
        quantity: 1,
        variant_id: null,
        variant_name: null,
      })
    );
    setCustomItem(createEmptyCustomItemDraft());
    setShowCustomItemModal(false);
  };

  const handleQuantityChange = (id: string, delta: number) => {
    setOrderItems((previous) =>
      previous
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  return {
    closeProductModal,
    handleAddCustomItem,
    handleAddProduct,
    handleQuantityChange,
    handleSelectProduct,
    resetProductPickerState,
  };
}
