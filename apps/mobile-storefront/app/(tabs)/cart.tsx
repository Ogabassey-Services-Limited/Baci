/**
 * Cart Screen - Matching Web Design
 * Beautiful card-based cart with condition tags, negotiations, and sticky checkout
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
// useSafeAreaInsets kept for future use
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import CartItemCard from '@/components/cart/CartItemCard';
import styles from '@/components/cart/styles';
import { CheckoutIdentityModal } from '@/components/checkout/checkout-identity';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, palette, RADIUS } from '@/constants/Colors';
import { useAuthStore } from '@/stores/auth-store';
import { type CartItem, formatPrice, useCartStore } from '@/stores/cart-store';
import { useUIStore } from '@/stores/ui-store';

export default function CartScreen() {
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const surfaceInset = isDark ? colors.muted : colors.background;
  const disabledIconColor = isDark ? colors.textSecondary : palette.gray[300];
  const negotiateSurface = isDark
    ? 'rgba(220, 38, 38, 0.12)'
    : colors.background;
  const negotiateBorder = isDark
    ? 'rgba(248, 113, 113, 0.35)'
    : palette.red[100];
  const checkoutDotColor = isDark
    ? 'rgba(0, 0, 0, 0.28)'
    : 'rgba(255,255,255,0.4)';

  const arrowTranslateX = useSharedValue(0);

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

  const hasCartLoadError =
    !Array.isArray(cartStore.items) ||
    typeof cartStore.itemCount !== 'function' ||
    typeof cartStore.subtotal !== 'function' ||
    typeof cartStore.updateQuantity !== 'function' ||
    typeof cartStore.removeItem !== 'function' ||
    typeof cartStore.clearCart !== 'function' ||
    typeof cartStore.toggleAssurance !== 'function';

  useEffect(() => {
    if (!hasCartLoadError) {
      return;
    }

    console.error('[CartScreen] Invalid cart store shape', {
      itemsType: typeof cartStore.items,
      hasItemCount: typeof cartStore.itemCount === 'function',
      hasSubtotal: typeof cartStore.subtotal === 'function',
      hasUpdateQuantity: typeof cartStore.updateQuantity === 'function',
      hasRemoveItem: typeof cartStore.removeItem === 'function',
      hasClearCart: typeof cartStore.clearCart === 'function',
      hasToggleAssurance: typeof cartStore.toggleAssurance === 'function',
    });
  }, [hasCartLoadError, cartStore]);

  const reportUnavailableCartAction = (action: string) => {
    console.error(`[CartScreen] Attempted cart action while unavailable: ${action}`);
  };

  const items = hasCartLoadError ? [] : cartStore.items;
  const itemCount = hasCartLoadError ? 0 : cartStore.itemCount();
  const subtotal = hasCartLoadError ? 0 : cartStore.subtotal();
  const updateQuantity = hasCartLoadError
    ? ((itemId: string, quantity: number) => {
        reportUnavailableCartAction(`updateQuantity(${itemId}, ${quantity})`);
      })
    : cartStore.updateQuantity;
  const removeItem = hasCartLoadError
    ? ((itemId: string) => {
        reportUnavailableCartAction(`removeItem(${itemId})`);
      })
    : cartStore.removeItem;
  const clearCart = hasCartLoadError
    ? () => {
        reportUnavailableCartAction('clearCart()');
      }
    : cartStore.clearCart;
  const toggleAssurance = hasCartLoadError
    ? ((itemId: string) => {
        reportUnavailableCartAction(`toggleAssurance(${itemId})`);
      })
    : cartStore.toggleAssurance;

  const { session } = useAuthStore(useShallow((s) => ({ session: s.session })));
  const { openNegotiation } = useUIStore(useShallow((s) => ({ openNegotiation: s.openNegotiation })));
  const hasItems = items.length > 0;

  useEffect(() => {
    cancelAnimation(arrowTranslateX);
    if (!hasItems) {
      arrowTranslateX.set(0);
      return;
    }

    arrowTranslateX.set(
      withRepeat(
        withSequence(
          withTiming(6, { duration: 800 }),
          withTiming(0, { duration: 800 })
        ),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(arrowTranslateX);
      arrowTranslateX.set(0);
    };
  }, [arrowTranslateX, hasItems]);

  const animatedArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowTranslateX.get() }],
  }));

  const triggerHaptic = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleQuantityChange = (item: CartItem, delta: number) => {
    if (pendingOperations.current.has(item.id)) return;
    const newQuantity = item.quantity + delta;
    triggerHaptic();

    if (newQuantity <= 0) {
      handleRemoveItem(item);
    } else {
      pendingOperations.current.add(item.id);
      updateQuantity(item.id, newQuantity);
      setTimeout(() => pendingOperations.current.delete(item.id), 200);
    }
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

  const handleClearCart = () => {
    Alert.alert('Clear Cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCart },
    ]);
  };

  const handleCheckout = () => {
    triggerHaptic();
    if (session) {
      router.push('/checkout');
    } else {
      setIsIdentityModalOpen(true);
    }
  };

  // Helper function to actually open item negotiation
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

  // Open item negotiation with warning check
  const openItemNegotiation = (item: CartItem) => {
    // Check if any item already has individual negotiation
    const hasAnyIndividualNegotiation = items.some(
      (i) => i.negotiatedPrice != null
    );

    // Check if cart-wide discount is active
    const hasBulkDiscount = items.some((i) => {
      const item = i as CartItem & { cartDiscount?: number };
      return (item.cartDiscount ?? 0) > 0;
    });

    if (hasBulkDiscount) {
      Alert.alert(
        'Bulk Discount Active',
        'You already have a bulk discount applied. Remove it before negotiating items individually.'
      );
      return;
    }

    if (hasAnyIndividualNegotiation) {
      // Already using individual mode, proceed directly
      actuallyOpenItemNegotiation(item);
    } else {
      // First negotiation - show warning modal
      setPendingNegotiateItem(item);
      setShowNegotiateWarning(true);
    }
  };

  // Open total/bulk negotiation
  const openTotalNegotiation = () => {
    if (items.some((i) => i.negotiationStatus === 'accepted')) {
      Alert.alert(
        'Negotiation Active',
        'Please reset individual item prices before negotiating the total cart.'
      );
      return;
    }
    triggerHaptic();
    openNegotiation({
      type: 'total',
      productName: 'Total Cart',
      currentPrice: grandTotal,
    });
    setShowNegotiateWarning(false);
    setPendingNegotiateItem(null);
  };

  // Calculate assurance total
  const assuranceTotal = items.reduce((sum, item) => {
    if (!item.hasAssurance) return sum;
    const price = item.negotiatedPrice ?? item.price;
    return (
      sum + Math.round(price * item.quantity * (item.assuranceRate ?? 0.05))
    );
  }, 0);

  const grandTotal = subtotal + assuranceTotal;

  if (hasCartLoadError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBg, { backgroundColor: surfaceInset }]}>
            <Ionicons name="warning-outline" size={56} color={BRAND.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Unable to load cart
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            We could not read your cart right now. Please try again.
          </Text>
          <Pressable
            style={[styles.shopButton, { backgroundColor: colors.text }]}
            disabled={isRetryingCartLoad}
            accessibilityState={{ disabled: isRetryingCartLoad, busy: isRetryingCartLoad }}
            onPress={() => {
              setIsRetryingCartLoad(true);
              const rehydrateResult = useCartStore.persist.rehydrate();
              void Promise.resolve(rehydrateResult)
                .catch((error) => {
                  console.error('[CartScreen] Failed to rehydrate cart store', error);
                })
                .finally(() => {
                  setIsRetryingCartLoad(false);
                  router.replace('/cart');
                });
            }}
          >
            {isRetryingCartLoad ? (
              <>
                <Text style={[styles.shopButtonText, { color: colors.background }]}>
                  Retrying...
                </Text>
                <ActivityIndicator
                  size="small"
                  color={colors.background}
                />
              </>
            ) : (
              <>
                <Text style={[styles.shopButtonText, { color: colors.background }]}>
                  Retry
                </Text>
                <Ionicons name="refresh" size={18} color={colors.background} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <View
            style={[styles.emptyIconBg, { backgroundColor: surfaceInset }]}
          >
            <Ionicons name="cart" size={56} color={BRAND.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Your cart is empty 🛒
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Browse our products and add items to your cart
          </Text>
          <Pressable
            style={[styles.shopButton, { backgroundColor: colors.text }]}
            onPress={() => router.push('/')}
          >
            <Text style={[styles.shopButtonText, { color: colors.background }]}>Start Shopping</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.background} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="cart" size={24} color={BRAND.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Cart</Text>
          <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
            ({itemCount})
          </Text>
        </View>
        <Pressable onPress={handleClearCart} hitSlop={12}>
          <Text style={[styles.clearText, { color: BRAND.primary }]}>
            Clear All
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 180 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <CartItemCard
            item={item}
            handleQuantityChange={handleQuantityChange}
            handleRemoveItem={handleRemoveItem}
            toggleAssurance={(itemId) => {
              triggerHaptic();
              toggleAssurance(itemId);
            }}
            openItemNegotiation={(cartItem) => {
              triggerHaptic();
              openItemNegotiation(cartItem);
            }}
            updateQuantity={updateQuantity}
            formatPrice={formatPrice}
            colors={colors}
            surfaceInset={surfaceInset}
            disabledIconColor={disabledIconColor}
            negotiateSurface={negotiateSurface}
            negotiateBorder={negotiateBorder}
          />
        )}
        ListFooterComponent={
          <>
            {/* Secure Checkout Badge */}
            <View style={styles.secureBadgeInside}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text
                style={[styles.secureBadgeText, { color: colors.textSecondary }]}
              >
                Secure Checkout
              </Text>
            </View>
          </>
        }
      />

      {/* Red Sticky Checkout Footer - HIGH VISIBILITY VERSION */}
      <View style={[styles.checkoutStickyFooter, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {/* Row 1: Hint Message (Now relative and centered) */}
        <View
          style={[
            styles.bulkHint,
            { backgroundColor: surfaceInset, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text
            style={[styles.bulkHintText, { color: colors.textSecondary }]}
          >
            Individual item negotiations take precedence over cart-wide
            discounts.
          </Text>
        </View>

        {/* Row 2: Action Buttons */}
        <View style={styles.footerActions}>
          <Pressable
            style={({ pressed }) => [
              styles.bulkButton,
              {
                backgroundColor: surfaceInset,
                borderColor: colors.border,
              },
              pressed && styles.bulkButtonPressed,
              items.some((i) => i.negotiationStatus === 'accepted') &&
                styles.bulkButtonDisabled,
            ]}
            onPress={openTotalNegotiation}
          >
            <View style={styles.bulkButtonContent}>
              <Ionicons
                name="cash-outline"
                size={22}
                color={
                  items.some((i) => i.negotiationStatus === 'accepted')
                    ? colors.textSecondary
                    : BRAND.primary
                }
              />
              <Text
                style={[
                  styles.bulkButtonText,
                  { color: BRAND.primary },
                  items.some((i) => i.negotiationStatus === 'accepted') && {
                    color: colors.textSecondary,
                  },
                ]}
              >
                Negotiate
              </Text>
            </View>
          </Pressable>

          {/* Checkout Button - Bulletproof Visibility Version */}
          <Pressable
            style={styles.checkoutButtonContainer}
            onPress={handleCheckout}
          >
            {/* Forced Background Layer */}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: colors.primary,
                  borderRadius: RADIUS.xl,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                },
              ]}
            />

            {/* Content Layer */}
            <View style={styles.checkoutButtonContent}>
              <Text style={[styles.checkoutBtnLabel, { color: colors.primaryForeground }]}>Checkout</Text>
              <View
                style={[
                  styles.checkoutBtnDot,
                  { backgroundColor: checkoutDotColor },
                ]}
              />
              <Text style={[styles.checkoutBtnPrice, { color: colors.primaryForeground }]}>
                {formatPrice(grandTotal || 0)}
              </Text>
              <Animated.View style={animatedArrowStyle}>
                <Ionicons name="arrow-forward" size={18} color={colors.background} />
              </Animated.View>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Checkout Identity Modal */}
      <CheckoutIdentityModal
        isOpen={isIdentityModalOpen}
        onClose={() => setIsIdentityModalOpen(false)}
      />

      {/* Negotiate Mode Warning Modal */}
      <Modal
        visible={showNegotiateWarning}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowNegotiateWarning(false);
          setPendingNegotiateItem(null);
        }}
      >
        <View style={styles.warningOverlay}>
          <Pressable
            style={styles.warningBackdrop}
            onPress={() => {
              setShowNegotiateWarning(false);
              setPendingNegotiateItem(null);
            }}
          />
          <View style={[styles.warningModal, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={styles.warningHeader}>
              <View style={[styles.warningIconCircle, { backgroundColor: colors.background }]}>
                <Ionicons name="cash-outline" size={24} color={colors.warning} />
              </View>
              <Text style={[styles.warningTitle, { color: colors.text }]}>
                Choose Negotiation Mode
              </Text>
            </View>

            {/* Description */}
            <Text
              style={[styles.warningDescription, { color: colors.textSecondary }]}
            >
              Negotiating items individually will disable bulk cart negotiation.
              <Text style={styles.warningDescriptionBold}>
                {' '}
                You can only use one approach.
              </Text>
            </Text>

            {/* Buttons */}
            <View style={styles.warningButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.warningPrimaryButton,
                  pressed && styles.warningButtonPressed,
                ]}
                onPress={() => {
                  if (pendingNegotiateItem) {
                    triggerHaptic();
                    actuallyOpenItemNegotiation(pendingNegotiateItem);
                  }
                }}
              >
                <Text style={[styles.warningPrimaryButtonText, { color: colors.primaryForeground }]}>
                  Negotiate This Item
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.warningSecondaryButton,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                  pressed && styles.warningButtonPressed,
                ]}
                onPress={() => {
                  triggerHaptic();
                  setShowNegotiateWarning(false);
                  setPendingNegotiateItem(null);
                  openTotalNegotiation();
                }}
              >
                <Ionicons
                  name="cash-outline"
                  size={18}
                  color={colors.text}
                />
                <Text
                  style={[
                    styles.warningSecondaryButtonText,
                    { color: colors.text },
                  ]}
                >
                  Bulk Negotiate Entire Cart
                </Text>
              </Pressable>

              <Pressable
                style={styles.warningCancelButton}
                onPress={() => {
                  setShowNegotiateWarning(false);
                  setPendingNegotiateItem(null);
                }}
              >
                <Text
                  style={[
                    styles.warningCancelButtonText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
