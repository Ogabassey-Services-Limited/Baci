import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import CartLoadedView from '@/components/cart/CartLoadedView';
import CartStateView from '@/components/cart/CartStateView';
import { unavailableCartActions } from '@/components/cart/unavailable-cart-actions';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuthStatus } from '@/hooks/use-auth-guard';
import { useHaptics } from '@/hooks/use-haptics';
import { isValidCartStore } from '@/lib/cart-validation';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';
import { type CartItem, formatPrice, useCartStore } from '@/stores/cart-store';
import { useUIStore } from '@/stores/ui-store';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[colorScheme];
  const { light: triggerHaptic } = useHaptics();
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [showNegotiateWarning, setShowNegotiateWarning] = useState(false);
  const [pendingNegotiateItem, setPendingNegotiateItem] =
    useState<CartItem | null>(null);
  const [isRetryingCartLoad, setIsRetryingCartLoad] = useState(false);
  const pendingOperations = useRef<Set<string>>(new Set());

  const cartStore = useCartStore(
    useShallow((state) => ({
      items: state.items,
      itemCount: state.itemCount,
      subtotal: state.subtotal,
      updateQuantity: state.updateQuantity,
      removeItem: state.removeItem,
      clearCart: state.clearCart,
      toggleAssurance: state.toggleAssurance,
    }))
  );
  const cartStoreSnapshot: unknown = cartStore;
  const isCartStoreValid = isValidCartStore(cartStoreSnapshot);
  const hasCartLoadError = !isCartStoreValid;

  useEffect(() => {
    if (isCartStoreValid) {
      return;
    }

    const invalidCartStore =
      cartStoreSnapshot && typeof cartStoreSnapshot === 'object'
        ? (cartStoreSnapshot as Record<string, unknown>)
        : {};

    console.error('[CartScreen] Invalid cart store shape', {
      itemsType: typeof invalidCartStore.items,
      hasItemCount: typeof invalidCartStore.itemCount === 'function',
      hasSubtotal: typeof invalidCartStore.subtotal === 'function',
      hasUpdateQuantity: typeof invalidCartStore.updateQuantity === 'function',
      hasRemoveItem: typeof invalidCartStore.removeItem === 'function',
      hasClearCart: typeof invalidCartStore.clearCart === 'function',
      hasToggleAssurance:
        typeof invalidCartStore.toggleAssurance === 'function',
    });
  }, [isCartStoreValid, cartStoreSnapshot]);

  const items = hasCartLoadError ? [] : cartStore.items;
  const itemCount = hasCartLoadError ? 0 : cartStore.itemCount();
  const subtotal = hasCartLoadError ? 0 : cartStore.subtotal();
  const updateQuantity = hasCartLoadError
    ? unavailableCartActions.updateQuantity
    : cartStore.updateQuantity;
  const removeItem = hasCartLoadError
    ? unavailableCartActions.removeItem
    : cartStore.removeItem;
  const clearCart = hasCartLoadError
    ? unavailableCartActions.clearCart
    : cartStore.clearCart;
  const toggleAssurance = hasCartLoadError
    ? unavailableCartActions.toggleAssurance
    : cartStore.toggleAssurance;
  const { isAuthenticated } = useAuthStatus();
  const { openNegotiation } = useUIStore(
    useShallow((state) => ({ openNegotiation: state.openNegotiation }))
  );
  const enableNegotiationModal =
    getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID).features
      ?.negotiationModal ?? true;

  useEffect(() => {
    if (!hasCartLoadError && items.length > 0) {
      router.prefetch('/checkout');
    }
  }, [hasCartLoadError, items.length]);

  const handleQuantityChange = (item: CartItem, delta: number) => {
    if (pendingOperations.current.has(item.id)) return;
    const newQuantity = item.quantity + delta;
    triggerHaptic();

    if (newQuantity <= 0) {
      handleRemoveItem(item);
      return;
    }

    pendingOperations.current.add(item.id);
    updateQuantity(item.id, newQuantity);
    setTimeout(() => pendingOperations.current.delete(item.id), 200);
  };

  const handleRemoveItem = (item: CartItem) => {
    if (pendingOperations.current.has(item.id)) return;
    Alert.alert('Remove Item', `Remove ${item.name} from cart?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          pendingOperations.current.add(item.id);
          removeItem(item.id);
          pendingOperations.current.delete(item.id);
        },
      },
    ]);
  };

  const handleCheckout = () => {
    triggerHaptic();
    if (isAuthenticated) {
      router.push('/checkout');
    } else {
      setIsIdentityModalOpen(true);
    }
  };

  const handleReturnHome = () => {
    triggerHaptic();
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  const actuallyOpenItemNegotiation = (item: CartItem) => {
    const priceToUse = item.negotiatedPrice ?? item.price;
    openNegotiation({
      type: 'single',
      itemId: item.id,
      productName:
        item.quantity > 1 ? `${item.name} (x${item.quantity})` : item.name,
      currentPrice: priceToUse * item.quantity,
    });
    setShowNegotiateWarning(false);
    setPendingNegotiateItem(null);
  };

  const openItemNegotiation = (item: CartItem) => {
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

  const assuranceTotal = items.reduce((sum, item) => {
    if (!item.hasAssurance) return sum;
    const price = item.negotiatedPrice ?? item.price;
    return (
      sum + Math.round(price * item.quantity * (item.assuranceRate ?? 0.05))
    );
  }, 0);
  const grandTotal = subtotal + assuranceTotal;
  const openTotalNegotiation = () => {
    if (items.some((item) => item.negotiationStatus === 'accepted')) {
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
    });
    setShowNegotiateWarning(false);
    setPendingNegotiateItem(null);
  };

  const handleRetryCartLoad = () => {
    setIsRetryingCartLoad(true);
    const rehydrateResult = useCartStore.persist.rehydrate();
    void Promise.resolve(rehydrateResult)
      .then(() => {
        router.replace('/cart');
      })
      .catch((error) => {
        console.error('[CartScreen] Failed to rehydrate cart store', error);
      })
      .finally(() => {
        setIsRetryingCartLoad(false);
      });
  };

  if (hasCartLoadError) {
    return (
      <CartStateView
        variant="error"
        colorScheme={colorScheme}
        colors={colors}
        isRetrying={isRetryingCartLoad}
        onRetry={handleRetryCartLoad}
        onStartShopping={() => router.push('/')}
      />
    );
  }

  if (items.length === 0) {
    return (
      <CartStateView
        variant="empty"
        colorScheme={colorScheme}
        colors={colors}
        isRetrying={false}
        onRetry={handleRetryCartLoad}
        onStartShopping={() => router.push('/')}
      />
    );
  }

  return (
    <CartLoadedView
      colorScheme={colorScheme}
      colors={colors}
      enableNegotiationModal={enableNegotiationModal}
      formatPrice={formatPrice}
      grandTotal={grandTotal}
      handleCheckout={handleCheckout}
      handleClearCart={() => {
        Alert.alert('Clear Cart', 'Remove all items from your cart?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: clearCart },
        ]);
      }}
      handleReturnHome={handleReturnHome}
      handleQuantityChange={handleQuantityChange}
      handleRemoveItem={handleRemoveItem}
      insetsTop={insets.top}
      isIdentityModalOpen={isIdentityModalOpen}
      itemCount={itemCount}
      items={items}
      onBulkNegotiate={openTotalNegotiation}
      onCloseIdentityModal={() => setIsIdentityModalOpen(false)}
      onCloseNegotiateWarning={() => {
        setShowNegotiateWarning(false);
        setPendingNegotiateItem(null);
      }}
      onCheckoutPressIn={() => router.prefetch('/checkout')}
      onNegotiateItem={actuallyOpenItemNegotiation}
      onNegotiateTotal={() => {
        triggerHaptic();
        openTotalNegotiation();
      }}
      onOpenItemNegotiation={(item) => {
        triggerHaptic();
        openItemNegotiation(item);
      }}
      pendingNegotiateItem={pendingNegotiateItem}
      removeClippedSubviews={Platform.OS === 'android'}
      showNegotiateWarning={showNegotiateWarning}
      toggleAssurance={(itemId) => {
        triggerHaptic();
        toggleAssurance(itemId);
      }}
      triggerHaptic={triggerHaptic}
      updateQuantity={updateQuantity}
    />
  );
}
