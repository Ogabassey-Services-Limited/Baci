import { useShallow } from 'zustand/react/shallow';
import { formatProductConditionDisplay } from '@/types/product';
import { useCartStore } from '@/stores/cart-store';
import type { useProductDetailRouteData } from './use-product-detail-route-data';

type RouteData = ReturnType<typeof useProductDetailRouteData>;

export function useProductDetailCartState(routeData: RouteData) {
  const { items, addItem, updateQuantity, removeItem } = useCartStore(
    useShallow((state) => ({
      items: state.items,
      addItem: state.addItem,
      updateQuantity: state.updateQuantity,
      removeItem: state.removeItem,
    }))
  );
  const getConditionDisplay = (): string | undefined => {
    if (routeData.currentVariantDisplaySelection?.condition) {
      return formatProductConditionDisplay(
        routeData.currentVariantDisplaySelection.condition
      );
    }
    if (routeData.offerConditionKey) {
      return formatProductConditionDisplay(routeData.offerConditionKey);
    }
    return routeData.product?.condition;
  };
  const cartItem = routeData.product
    ? items.find(
        (item) =>
          item.product_id === routeData.product?.id &&
          (item.variant_id || null) ===
            (routeData.effectiveSelectedVariantId || null) &&
          (item.condition || null) === (getConditionDisplay() || null) &&
          (item.color || null) === (routeData.effectiveSelectedColor || null) &&
          (item.storage || null) ===
            (routeData.effectiveSelectedStorage || null)
      )
    : undefined;

  return {
    addItem,
    cartItem,
    getConditionDisplay,
    quantityInCart: cartItem ? cartItem.quantity : 0,
    removeItem,
    updateQuantity,
  };
}
