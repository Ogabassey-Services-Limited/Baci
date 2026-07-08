import type { OrderSource, PaymentStatus } from '@baci/shared';
import type { Dispatch, SetStateAction } from 'react';
import {
  createEmptyCustomerInfo,
  createEmptyDeliveryInfo,
} from '@/components/orders/new-order.defaults';
import type {
  CustomerInfo,
  DeliveryInfo,
  OrderItem,
  SelectableOrderProduct,
  SelectedParentProduct,
} from '@/components/orders/new-order.types';
import { normalizeVariantAttributes } from '@/lib/product-picker-variant-rows';
import type { Product } from './useProducts';
import type { useNewOrderUiState } from './useNewOrderUiState';

type Setter<T> = Dispatch<SetStateAction<T>>;
type NewOrderUiState = ReturnType<typeof useNewOrderUiState>;

interface ResetOrderDraftArgs {
  defaultBranchId: string | null;
  isVatRegistered: boolean;
  setCustomer: Setter<CustomerInfo>;
  setDate: Setter<Date>;
  setDeliveryInfo: Setter<DeliveryInfo>;
  setDiscount: Setter<number>;
  setIsVatApplied: Setter<boolean>;
  setNotes: Setter<string>;
  setOrderItems: Setter<OrderItem[]>;
  setPartialAmount: Setter<string>;
  setPaymentMethod: Setter<string>;
  setPaymentStatus: Setter<PaymentStatus>;
  setSameAsCustomer: Setter<boolean>;
  setSelectedBranchId: Setter<string | null>;
  setSelectedChannel: Setter<OrderSource | null>;
  setShippingFee: Setter<number>;
  setTaxes: Setter<number>;
  setVariantReplacementItemId: Setter<string | null>;
  uiState: Pick<NewOrderUiState, 'setLastOrderId'>;
}

export function createResetOrderDraft({
  defaultBranchId,
  isVatRegistered,
  setCustomer,
  setDate,
  setDeliveryInfo,
  setDiscount,
  setIsVatApplied,
  setNotes,
  setOrderItems,
  setPartialAmount,
  setPaymentMethod,
  setPaymentStatus,
  setSameAsCustomer,
  setSelectedBranchId,
  setSelectedChannel,
  setShippingFee,
  setTaxes,
  setVariantReplacementItemId,
  uiState,
}: ResetOrderDraftArgs) {
  return () => {
    setDate(new Date());
    setSelectedChannel('physical');
    setSelectedBranchId(defaultBranchId);
    setPaymentStatus('unpaid');
    setCustomer(createEmptyCustomerInfo());
    setOrderItems([]);
    setNotes('');
    setDiscount(0);
    setShippingFee(0);
    setTaxes(0);
    setIsVatApplied(isVatRegistered);
    setSameAsCustomer(true);
    setDeliveryInfo(createEmptyDeliveryInfo());
    setPartialAmount('');
    setPaymentMethod('transfer');
    setVariantReplacementItemId(null);
    uiState.setLastOrderId(null);
  };
}

interface ChangeEditingItemVariantHandlerArgs {
  setProductSearch: Setter<string>;
  setSelectedParentProduct: Setter<SelectedParentProduct>;
  setVariantReplacementItemId: Setter<string | null>;
  uiState: Pick<
    NewOrderUiState,
    'editingItem' | 'setShowEditItemModal' | 'setShowProductModal'
  >;
}

export function createChangeEditingItemVariantHandler({
  setProductSearch,
  setSelectedParentProduct,
  setVariantReplacementItemId,
  uiState,
}: ChangeEditingItemVariantHandlerArgs) {
  return () => {
    const item = uiState.editingItem;
    if (!item?.product_id || !item.variant_id || item.is_custom) {
      return;
    }

    setVariantReplacementItemId(item.id);
    setSelectedParentProduct({
      condition: item.condition ?? null,
      has_variants: true,
      id: item.product_id,
      images: item.image_url ? [item.image_url] : [],
      name: item.name,
      parent_product_id: null,
      price: item.price,
      sku: null,
      variant_attributes: item.variant_attributes ?? null,
    });
    setProductSearch('');
    uiState.setShowEditItemModal(false);
    uiState.setShowProductModal(true);
  };
}

interface SelectableProductRowsArgs {
  filteredProducts: Product[];
  isPickingVariant: boolean;
  selectedParentProductVariantsData?: SelectableOrderProduct[];
}

export function getSelectableProductRows({
  filteredProducts,
  isPickingVariant,
  selectedParentProductVariantsData,
}: SelectableProductRowsArgs): SelectableOrderProduct[] {
  if (isPickingVariant) {
    return selectedParentProductVariantsData ?? [];
  }

  return filteredProducts.map((product) => ({
    ...product,
    variant_attributes: normalizeVariantAttributes(product.variant_attributes),
  }));
}
