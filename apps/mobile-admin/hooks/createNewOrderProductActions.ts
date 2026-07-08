import * as Crypto from 'expo-crypto';
import type { Dispatch, SetStateAction } from 'react';
import { createEmptyCustomItemDraft } from '@/components/orders/new-order.defaults';
import type {
  CustomItemDraft,
  OrderItem,
  SelectableOrderProduct,
  SelectedParentProduct,
} from '@/components/orders/new-order.types';
import { buildManualOrderLineItem } from '@/lib/manual-order-line-item';
import { mergeOrderItem } from '@/lib/order-items';

interface CreateNewOrderProductActionsParams {
  customItem: CustomItemDraft;
  orderItems: OrderItem[];
  selectedParentProduct: SelectedParentProduct;
  setCustomItem: Dispatch<SetStateAction<CustomItemDraft>>;
  setOrderItems: Dispatch<SetStateAction<OrderItem[]>>;
  setProductSearch: Dispatch<SetStateAction<string>>;
  setSelectedParentProduct: Dispatch<SetStateAction<SelectedParentProduct>>;
  setShowCustomItemModal: Dispatch<SetStateAction<boolean>>;
  setShowProductModal: Dispatch<SetStateAction<boolean>>;
  setVariantReplacementItemId?: Dispatch<SetStateAction<string | null>>;
  variantReplacementItemId?: string | null;
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
  setVariantReplacementItemId,
  variantReplacementItemId = null,
}: CreateNewOrderProductActionsParams) {
  const resetProductPickerState = () => {
    setSelectedParentProduct(null);
    setVariantReplacementItemId?.(null);
  };

  const closeProductModal = () => {
    resetProductPickerState();
    setShowProductModal(false);
    setProductSearch('');
  };

  const addProductToOrder = (product: SelectableOrderProduct) => {
    const nextItem = buildManualOrderLineItem({
      fallbackImageUrl: selectedParentProduct?.images?.[0],
      parentProductName: selectedParentProduct?.name,
      product,
    });
    const { condition, ...restNextItem } = nextItem;
    const normalizedNextItem =
      condition === undefined ? restNextItem : nextItem;

    setOrderItems((previous) => {
      if (!variantReplacementItemId) {
        return mergeOrderItem(previous, normalizedNextItem);
      }

      if (!previous.some((item) => item.id === variantReplacementItemId)) {
        return mergeOrderItem(previous, normalizedNextItem);
      }

      return previous.map((item) =>
        item.id === variantReplacementItemId
          ? ({
              ...normalizedNextItem,
              ...(item.details !== undefined ? { details: item.details } : {}),
              ...(item.product_match_status !== undefined
                ? { product_match_status: item.product_match_status }
                : {}),
              id: item.id,
              quantity: item.quantity,
            } satisfies OrderItem)
          : item
      );
    });
  };

  const handleAddProduct = (product: SelectableOrderProduct) => {
    addProductToOrder(product);
    closeProductModal();
  };

  const handleSelectProduct = (product: SelectableOrderProduct) => {
    if (!product.has_variants) {
      handleAddProduct(product);
      return;
    }

    setSelectedParentProduct(product);
  };

  const handleUseQuickAddProductMatch = (product: SelectableOrderProduct) => {
    addProductToOrder(product);
    setCustomItem(createEmptyCustomItemDraft());
    setShowCustomItemModal(false);
  };

  const handleContinueAsCustomItem = () => {
    const normalizedName = customItem.name.trim().replace(/\s+/g, ' ');
    const parsedPrice = Number.parseFloat(customItem.price);
    if (
      !normalizedName ||
      !customItem.price ||
      Number.isNaN(parsedPrice) ||
      parsedPrice <= 0
    ) {
      return;
    }

    setOrderItems((previous) =>
      mergeOrderItem(previous, {
        id: `custom-${Crypto.randomUUID()}`,
        is_custom: true,
        name: normalizedName,
        price: parsedPrice,
        product_match_status: 'custom',
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
    handleAddCustomItem: handleContinueAsCustomItem,
    handleAddProduct,
    handleContinueAsCustomItem,
    handleQuantityChange,
    handleSelectProduct,
    handleUseQuickAddProductMatch,
    resetProductPickerState,
  };
}
