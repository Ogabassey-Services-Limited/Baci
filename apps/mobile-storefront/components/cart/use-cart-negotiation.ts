import { isProductNegotiable } from '@baci/shared/lib';
import { useState } from 'react';
import { Alert } from 'react-native';
import { getCartItemEffectivePrice } from '@/lib/cart-pricing';
import { useShallow } from 'zustand/react/shallow';
import type { CartItem } from '@/stores/cart-store';
import { useUIStore } from '@/stores/ui-store';

interface UseCartNegotiationParams {
  items: CartItem[];
  grandTotal: number;
}

export function useCartNegotiation({
  items,
  grandTotal,
}: UseCartNegotiationParams) {
  const [showNegotiateWarning, setShowNegotiateWarning] = useState(false);
  const [pendingNegotiateItem, setPendingNegotiateItem] =
    useState<CartItem | null>(null);

  const { openNegotiation } = useUIStore(
    useShallow((state) => ({ openNegotiation: state.openNegotiation }))
  );

  const hasNonNegotiableCartItem = items.some(
    (item) => !isProductNegotiable({ brand: item.brand, name: item.name })
  );

  const actuallyOpenItemNegotiation = (item: CartItem) => {
    const priceToUse = getCartItemEffectivePrice(item);
    openNegotiation({
      type: 'single',
      itemId: item.id,
      productName:
        item.quantity > 1 ? `${item.name} (x${item.quantity})` : item.name,
      currentPrice: priceToUse * item.quantity,
      brand: item.brand,
      isNegotiable: isProductNegotiable({ brand: item.brand, name: item.name }),
    });
    setShowNegotiateWarning(false);
    setPendingNegotiateItem(null);
  };

  const openItemNegotiation = (item: CartItem) => {
    if (!isProductNegotiable({ brand: item.brand, name: item.name })) {
      Alert.alert('Best Price', 'This item is already at the best price.');
      return;
    }

    const hasAnyIndividualNegotiation = items.some(
      (cartItem) => cartItem.negotiatedPrice != null
    );
    const hasBulkDiscount = items.some((cartItem) => {
      const discountedItem = cartItem as CartItem & { cartDiscount?: number };
      return (discountedItem.cartDiscount ?? 0) > 0;
    });

    if (hasBulkDiscount) {
      Alert.alert(
        'Bulk Discount Active',
        'You already have a bulk discount applied. Remove it before negotiating items individually.'
      );
      return;
    }

    if (hasAnyIndividualNegotiation) {
      actuallyOpenItemNegotiation(item);
    } else {
      setPendingNegotiateItem(item);
      setShowNegotiateWarning(true);
    }
  };

  const openTotalNegotiation = () => {
    if (hasNonNegotiableCartItem) {
      Alert.alert(
        'Best Price Item in Cart',
        'Cart-wide negotiation is unavailable while your cart includes a best-price item.'
      );
      return;
    }

    if (
      items.some(
        (item) =>
          item.negotiationStatus === 'accepted' || item.negotiatedPrice != null
      )
    ) {
      Alert.alert(
        'Negotiation Active',
        'Please reset individual item prices before negotiating the total cart.'
      );
      return;
    }

    openNegotiation({
      type: 'total',
      productName: 'Total Cart',
      currentPrice: grandTotal,
      isNegotiable: true,
    });
    setShowNegotiateWarning(false);
    setPendingNegotiateItem(null);
  };

  return {
    showNegotiateWarning,
    setShowNegotiateWarning,
    pendingNegotiateItem,
    setPendingNegotiateItem,
    hasNonNegotiableCartItem,
    actuallyOpenItemNegotiation,
    openItemNegotiation,
    openTotalNegotiation,
  };
}
