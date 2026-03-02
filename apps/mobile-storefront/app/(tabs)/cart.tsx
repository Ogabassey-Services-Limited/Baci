/**
 * Cart Screen - Matching Web Design
 * Beautiful card-based cart with condition tags, negotiations, and sticky checkout
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
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
import { CheckoutIdentityModal } from '@/components/checkout/checkout-identity';
import { SafeImage } from '@/components/ui/SafeImage';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, {
  BRAND,
  palette,
  RADIUS,
  SHADOWS,
  SPACING,
} from '@/constants/Colors';
import { useAuthStore } from '@/stores/auth-store';
import { type CartItem, formatPrice, useCartStore } from '@/stores/cart-store';
import { useUIStore } from '@/stores/ui-store';

// Helper component for editable quantity in list (2026 Best Practice for performance)
const CartQuantityInput = ({
  value,
  onChange,
  style,
}: {
  value: number;
  onChange: (val: number) => void;
  style: StyleProp<TextStyle>;
}) => {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  return (
    <TextInput
      style={style}
      value={localValue}
      textAlignVertical="center"
      onChangeText={(text) => {
        const cleanText = text.replace(/[^0-9]/g, '');
        setLocalValue(cleanText);
        const num = Number.parseInt(cleanText, 10);
        if (!Number.isNaN(num) && num > 0) {
          onChange(num);
        }
      }}
      onBlur={() => {
        const num = Number.parseInt(localValue, 10);
        if (Number.isNaN(num) || num <= 0) {
          setLocalValue(value.toString());
        } else {
          onChange(num);
        }
      }}
      keyboardType="number-pad"
      returnKeyType="done"
    />
  );
};

export default function CartScreen() {
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[colorScheme];

  const arrowTranslateX = useSharedValue(0);

  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [showNegotiateWarning, setShowNegotiateWarning] = useState(false);
  const [pendingNegotiateItem, setPendingNegotiateItem] =
    useState<CartItem | null>(null);
  const pendingOperations = useRef<Set<string>>(new Set());

  const items = useCartStore((state) => state.items);
  const itemCount = useCartStore((state) => state.itemCount());
  const subtotal = useCartStore((state) => state.subtotal());
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const toggleAssurance = useCartStore((state) => state.toggleAssurance);

  const { session } = useAuthStore(useShallow((s) => ({ session: s.session })));
  const openNegotiation = useUIStore((state) => state.openNegotiation);
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

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <View
            style={[styles.emptyIconBg, { backgroundColor: palette.gray[100] }]}
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
    <View style={[styles.container, { backgroundColor: palette.gray[50] }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 180 }]}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => {
          const priceToUse = item.negotiatedPrice ?? item.price;
          const itemTotal = priceToUse * item.quantity;
          const assuranceCost = item.hasAssurance
            ? Math.round(itemTotal * (item.assuranceRate ?? 0.05))
            : 0;

          return (
            <View key={item.id} style={[styles.cartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Top Row: Image & Info */}
              <View style={styles.cardTop}>
                <Pressable
                  style={styles.imageContainer}
                  onPress={() =>
                    router.push(`/product/${item.slug || item.product_id}`)
                  }
                >
                  <SafeImage
                    source={{
                      uri:
                        item.image_url ||
                        'https://placehold.co/100x100/f8fafc/94a3b8?text=No+Image',
                    }}
                    style={styles.productImage}
                    contentFit="contain"
                  />
                </Pressable>

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name}
                  </Text>

                  {/* Tags Row */}
                  <View style={styles.tagsRow}>
                    <View
                      style={[
                        styles.conditionTag,
                        item.condition?.toLowerCase() === 'new'
                          ? [styles.conditionTagNew, { backgroundColor: colors.background, borderColor: colors.success }]
                          : [styles.conditionTagUsed, { backgroundColor: colors.background, borderColor: colors.warning }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.conditionTagText,
                          item.condition?.toLowerCase() === 'new'
                            ? [styles.conditionTagTextNew, { color: colors.success }]
                            : [styles.conditionTagTextUsed, { color: colors.warning }],
                        ]}
                      >
                        {item.condition || 'NEW'}
                      </Text>
                    </View>
                    {item.color && (
                      <View style={styles.colorTag}>
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: item.color },
                          ]}
                        />
                        <Text style={styles.colorTagText}>{item.color}</Text>
                      </View>
                    )}
                    {item.storage && (
                      <View style={styles.storageTag}>
                        <Text style={styles.storageTagText}>
                          {item.storage}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Remove Button */}
                <Pressable
                  style={styles.removeButton}
                  onPress={() => handleRemoveItem(item)}
                  hitSlop={12}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={BRAND.primary}
                  />
                </Pressable>
              </View>

              {/* Dashed Separator */}
              <View style={styles.dashedSeparator} />

              {/* Quantity & Price Row */}
              <View style={styles.controlsRow}>
                <View style={styles.quantityControls}>
                  <Pressable
                    style={styles.quantityButton}
                    onPress={() => handleQuantityChange(item, -1)}
                    disabled={item.quantity <= 1}
                  >
                    <Ionicons
                      name="remove"
                      size={16}
                      color={
                        item.quantity <= 1
                          ? palette.gray[300]
                          : palette.gray[600]
                      }
                    />
                  </Pressable>
                  <CartQuantityInput
                    style={styles.quantityText}
                    value={item.quantity}
                    onChange={(newQty) => updateQuantity(item.id, newQty)}
                  />
                  <Pressable
                    style={styles.quantityButton}
                    onPress={() => handleQuantityChange(item, 1)}
                  >
                    <Ionicons name="add" size={16} color={palette.gray[600]} />
                  </Pressable>
                </View>

                <View style={styles.priceContainer}>
                  {item.negotiatedPrice ? (
                    <>
                      <Text style={styles.originalPrice}>
                        {formatPrice(item.price * item.quantity)}
                      </Text>
                      <Text style={[styles.negotiatedPrice, { color: colors.success }]}>
                        {formatPrice(itemTotal)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.currentPrice}>
                      {formatPrice(itemTotal)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Separator */}
              <View style={styles.solidSeparator} />

              {/* Bottom Row: Assurance & Negotiate */}
              <View style={styles.bottomRow}>
                {/* Assurance Toggle */}
                <Pressable
                  style={styles.assuranceContainer}
                  onPress={() => {
                    triggerHaptic();
                    toggleAssurance(item.id);
                  }}
                >
                  <View
                    style={[
                      styles.toggle,
                      item.hasAssurance && styles.toggleActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        item.hasAssurance && styles.toggleKnobActive,
                        { backgroundColor: colors.background }
                      ]}
                    />
                  </View>
                  <View style={styles.assuranceInfo}>
                    <View style={styles.assuranceHeader}>
                      <Ionicons
                        name="shield-checkmark"
                        size={12}
                        color={BRAND.primary}
                      />
                      <Text style={styles.assuranceTitle}>
                        Ogabassey Assurance
                      </Text>
                    </View>
                    <Text style={styles.assuranceDesc}>
                      {item.hasAssurance
                        ? `Screen & Liquid Damage +${formatPrice(assuranceCost)}`
                        : 'Device Protection (+5%)'}
                    </Text>
                  </View>
                </Pressable>

                {/* Negotiate Button */}
                {item.negotiationStatus === 'accepted' ? (
                  <View style={[styles.negotiatedBadge, { backgroundColor: colors.background, borderColor: colors.success }]}>
                    <Ionicons name="checkmark" size={12} color={colors.success} />
                    <Text style={[styles.negotiatedBadgeText, { color: colors.success }]}>Matched</Text>
                  </View>
                ) : (
                  <Pressable
                    style={styles.negotiateButton}
                    onPress={() => {
                      triggerHaptic();
                      openItemNegotiation(item);
                    }}
                  >
                    <Ionicons
                      name="pricetag-outline"
                      size={14}
                      color={BRAND.primary}
                    />
                    <Text style={styles.negotiateButtonText}>Negotiate</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

        {/* Order Summary - Now inside ScrollView */}

        {/* Secure Checkout Badge */}
        <View style={styles.secureBadgeInside}>
          <Ionicons
            name="shield-checkmark-outline"
            size={14}
            color={palette.gray[400]}
          />
          <Text style={styles.secureBadgeText}>Secure Checkout</Text>
        </View>
      </ScrollView>

      {/* Red Sticky Checkout Footer - HIGH VISIBILITY VERSION */}
      <View style={[styles.checkoutStickyFooter, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {/* Row 1: Hint Message (Now relative and centered) */}
        <View style={styles.bulkHint}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={palette.gray[500]}
          />
          <Text style={styles.bulkHintText}>
            Individual item negotiations take precedence over cart-wide
            discounts.
          </Text>
        </View>

        {/* Row 2: Action Buttons */}
        <View style={styles.footerActions}>
          <Pressable
            style={({ pressed }) => [
              styles.bulkButton,
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
                    ? palette.gray[400]
                    : BRAND.primary
                }
              />
              <Text
                style={[
                  styles.bulkButtonText,
                  items.some((i) => i.negotiationStatus === 'accepted') && {
                    color: palette.gray[400],
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
              <Text style={styles.checkoutBtnLabel}>Checkout</Text>
              <View style={styles.checkoutBtnDot} />
              <Text style={styles.checkoutBtnPrice}>
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
              <Text style={styles.warningTitle}>Choose Negotiation Mode</Text>
            </View>

            {/* Description */}
            <Text style={styles.warningDescription}>
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
                <Text style={styles.warningPrimaryButtonText}>
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
                  color={palette.gray[800]}
                />
                <Text style={styles.warningSecondaryButtonText}>
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
                <Text style={styles.warningCancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray[100],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  headerCount: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  clearText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  cartCard: {
    borderRadius: RADIUS['2xl'],
    padding: SPACING.md,
    ...SHADOWS.sm,
    borderWidth: 1,
  },
  cardTop: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  imageContainer: {
    width: 80,
    height: 80,
    backgroundColor: palette.gray[50],
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: palette.gray[100],
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
    paddingRight: 24,
  },
  productName: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[900],
    lineHeight: 18,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  conditionTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  conditionTagNew: {
  },
  conditionTagUsed: {
  },
  conditionTagText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  conditionTagTextNew: {
    // color provided inline via colors.success
  },
  conditionTagTextUsed: {
    // color provided inline via colors.warning
  },
  colorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.gray[50],
    borderWidth: 1,
    borderColor: palette.gray[100],
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.gray[300],
  },
  colorTagText: {
    fontSize: 10,
    color: palette.gray[600],
  },
  storageTag: {
    backgroundColor: palette.gray[50],
    borderWidth: 1,
    borderColor: palette.gray[100],
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  storageTagText: {
    fontSize: 10,
    color: palette.gray[600],
  },
  removeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
  },
  dashedSeparator: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: palette.gray[100],
    marginVertical: SPACING.md,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.gray[50],
    borderWidth: 1,
    borderColor: palette.gray[200],
    borderRadius: RADIUS.lg,
    height: 36,
  },
  quantityButton: {
    width: 36,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[900],
    minWidth: 28,
    textAlign: 'center',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: 10,
    color: palette.gray[400],
    textDecorationLine: 'line-through',
    fontFamily: 'Inter_400Regular',
  },
  negotiatedPrice: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    // color provided inline via colors.success
  },
  currentPrice: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[900],
  },
  solidSeparator: {
    height: 1,
    backgroundColor: palette.gray[100],
    marginTop: SPACING.md,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  assuranceContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  toggle: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.gray[200],
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: BRAND.primary,
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  assuranceInfo: {
    flex: 1,
  },
  assuranceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assuranceTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[800],
  },
  assuranceDesc: {
    fontSize: 10,
    color: palette.gray[500],
    marginTop: 2,
  },
  negotiateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.red[100],
  },
  negotiateButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: BRAND.primary,
  },
  negotiatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  negotiatedBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    // color provided inline via colors.success
  },
  checkoutStickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20, // Increased for safe area and spacing
    borderTopWidth: 1,
    ...SHADOWS.lg,
    zIndex: 1000,
  },
  bulkHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.gray[50], // Light background for the hint
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: palette.gray[100],
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulkButton: {
    width: 90, // Fixed width for negotiate button
    height: 56,
    backgroundColor: palette.gray[50],
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.gray[200],
    marginLeft: 8, // Shifted right as requested
  },
  bulkButtonContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  checkoutButtonContainer: {
    flex: 1,
    height: 56,
  },
  checkoutButtonContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkoutBtnLabel: {
    // Intentional white text on colored (primary) button background
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  checkoutBtnDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    // Intentional translucent white dot separator on colored button
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  checkoutBtnPrice: {
    // Intentional white text on colored (primary) button background
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  bulkHintText: {
    fontSize: 9,
    color: palette.gray[500],
    fontFamily: 'Inter_500Medium',
  },
  bulkButtonDisabled: {
    backgroundColor: palette.gray[50],
    borderColor: palette.gray[100],
    opacity: 0.8,
  },
  bulkButtonPressed: {
    backgroundColor: palette.gray[100],
    transform: [{ scale: 0.96 }],
  },
  bulkButtonText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[700],
    textAlign: 'center',
  },
  redCheckoutButton: {
    height: 56,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
    zIndex: 100,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  redCheckoutButtonPressed: {
    backgroundColor: '#DC2626',
    transform: [{ scale: 0.98 }],
  },
  checkoutButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  redCheckoutButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
  checkoutDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  redCheckoutPriceText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
  summaryCard: {
    marginTop: SPACING.md,
    backgroundColor: '#FFF',
    borderRadius: RADIUS['2xl'],
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: palette.gray[100],
    marginBottom: SPACING.md,
  },
  secureBadgeInside: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: SPACING.xl,
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[900],
    marginBottom: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: palette.gray[600],
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: palette.gray[900],
  },
  assurancePercentBadge: {
    backgroundColor: palette.red[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.red[100],
  },
  assurancePercentText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: BRAND.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: palette.gray[200],
    marginVertical: 8,
    borderStyle: 'dashed',
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[900],
  },
  totalValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[900],
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
    ...SHADOWS.lg,
  },
  checkoutButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  checkoutButtonDisabled: {
    opacity: 0.7,
  },
  checkoutButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
  },
  secureBadgeText: {
    fontSize: 12,
    color: palette.gray[400],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
    ...SHADOWS.lg,
  },
  shopButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
  // Warning Modal Styles
  warningOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  warningBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  warningModal: {
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    ...SHADOWS.xl,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  warningIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningTitle: {
    flex: 1,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[900],
  },
  warningDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: palette.gray[600],
    marginBottom: 22,
  },
  warningDescriptionBold: {
    fontFamily: 'Inter_600SemiBold',
  },
  warningButtons: {
    gap: 12,
  },
  warningPrimaryButton: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  warningPrimaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
  warningSecondaryButton: {
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  warningSecondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[800],
  },
  warningCancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  warningCancelButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: palette.gray[500],
  },
  warningButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
