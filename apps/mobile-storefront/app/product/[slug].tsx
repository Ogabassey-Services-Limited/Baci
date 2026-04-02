/**
 * Product Detail Screen - Elite 2025 Edition
 * - Parallax image header with Reanimated
 * - Dynamic translucent navigation bar
 * - Fluid typography and premium spacing
 * - High-performance image handling via expo-image
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  type GestureResponderEvent,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProductDetail');

import Animated, {
  Extrapolate,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import {
  resolveDefaultVariantSelection,
  resolveVariantSelection,
} from '../../../../packages/shared/src/lib/product-default-variant';
import { OfflineEmptyState } from '@/components/OfflineNotice';
import { FlyToCartParticle } from '@/components/product/FlyToCartParticle';
import { NegotiationModal } from '@/components/product/NegotiationModal';
import { ProductDetailsBody } from '@/components/product/ProductDetailsBody';
import { ProductImageGallery } from '@/components/product/ProductImageGallery';
import { StickyBottomActions } from '@/components/product/StickyBottomActions';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { resolveCartItemImageUrl } from '@/lib/cart-display';
import { useProduct } from '@/hooks';
import { useEffectivePrice } from '@/hooks/use-effective-price';
import { useHaptics } from '@/hooks/use-haptics';
import { useNetworkState } from '@/hooks/use-network-state';
import { markReviewHelpful, useReviews } from '@/hooks/use-reviews';
import { useCartStore } from '@/stores/cart-store';
import { useSavedStore } from '@/stores/saved-store';
import {
  formatProductConditionDisplay,
  getDiscountPercentage,
  type ProductCondition,
} from '@/types/product';

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // L3 FIX: Use Dimensions.get for static sizing; safe for constants file usage
  const HEADER_HEIGHT = Dimensions.get('window').width; // Square aspect ratio for main image

  // 2026 Critical Fix: Validate slug parameter early
  const isValidSlug = Boolean(
    slug && typeof slug === 'string' && slug.length > 0
  );

  // 2026 Best Practice: Network state monitoring for offline UX
  // Note: Manual onReconnect refetch removed — onlineManager.setOnline(true)
  // combined with refetchOnReconnect: true handles automatic refetching.
  const { isOnline } = useNetworkState();

  // 2026 Best Practice: Haptic feedback for tactile UX
  const haptics = useHaptics();

  // Only fetch if we have a valid slug
  const { product, isLoading, error, refetch } = useProduct(
    isValidSlug ? slug : ''
  );
  const { items, addItem, updateQuantity, removeItem } = useCartStore(
    useShallow((s) => ({
      items: s.items,
      addItem: s.addItem,
      updateQuantity: s.updateQuantity,
      removeItem: s.removeItem,
    }))
  );
  const toggleSaved = useSavedStore((state) => state.toggleSaved);
  const isSaved = useSavedStore((state) => state.isSaved);
  const savedToastState = useSavedStore((state) => state.toastState);
  const dismissSavedToast = useSavedStore((state) => state.dismissToast);

  // Fetch reviews for this product
  const {
    reviews,
    stats: reviewStats,
    isLoading: reviewsLoading,
    hasMore: hasMoreReviews,
    loadMore: loadMoreReviews,
  } = useReviews({ productId: product?.id || '' });

  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] =
    useState<ProductCondition | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});
  const [colorImages, setColorImages] = useState<string[] | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [negotiatedPrice, setNegotiatedPrice] = useState<number | null>(null);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const syncedDefaultSelectionProductIdRef = useRef<string | null>(null);

  const defaultVariantSelection = product
    ? resolveDefaultVariantSelection(product)
    : null;
  const currentVariantSelection = product?.has_variants
    ? resolveVariantSelection(product, {
        variantId: selectedVariant,
        attributes: {
          storage: selectedStorage,
          color: selectedColor,
          ...selectedAttributes,
        },
      }) ??
      (!selectedVariant &&
      !selectedStorage &&
      !selectedColor &&
      Object.keys(selectedAttributes).length === 0
        ? defaultVariantSelection
        : null)
    : null;
  const effectiveSelectedVariantId =
    currentVariantSelection?.variant.id ?? selectedVariant;
  const effectiveSelectedStorage =
    currentVariantSelection?.storage ?? selectedStorage;
  const effectiveSelectedColor = currentVariantSelection?.color ?? selectedColor;
  const effectiveSelectedAttributes = {
    ...selectedAttributes,
    ...Object.fromEntries(
      Object.entries(currentVariantSelection?.attributes ?? {}).filter(
        ([axis]) => axis !== 'color' && axis !== 'storage'
      )
    ),
  };

  // Timer ref for toast cleanup - prevents memory leaks (2026 Best Practice)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup toast timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  // 2026 Best Practice: Auto-dismiss saved items toast with cleanup
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (savedToastState.show) {
      if (savedToastTimerRef.current) {
        clearTimeout(savedToastTimerRef.current);
      }
      savedToastTimerRef.current = setTimeout(() => {
        dismissSavedToast();
        savedToastTimerRef.current = null;
      }, 2000);
    }
    return () => {
      if (savedToastTimerRef.current) {
        clearTimeout(savedToastTimerRef.current);
        savedToastTimerRef.current = null;
      }
    };
  }, [savedToastState.show, dismissSavedToast]);

  // Get condition display name for cart
  const getConditionDisplay = (): string | undefined => {
    if (selectedCondition) {
      return formatProductConditionDisplay(selectedCondition);
    }
    return product?.condition;
  };

  useEffect(() => {
    if (!product) {
      syncedDefaultSelectionProductIdRef.current = null;
      return;
    }

    if (syncedDefaultSelectionProductIdRef.current === product.id) {
      return;
    }

    const defaultSelection = resolveDefaultVariantSelection(product);
    setSelectedVariant(defaultSelection?.variant.id ?? null);
    setSelectedStorage(defaultSelection?.storage ?? null);
    setSelectedColor(defaultSelection?.color ?? null);
    setSelectedAttributes(
      Object.fromEntries(
        Object.entries(defaultSelection?.attributes ?? {}).filter(
          ([axis]) => axis !== 'color' && axis !== 'storage'
        )
      )
    );
    setColorImages(
      defaultSelection?.color
        ? product.color_images?.[defaultSelection.color] ?? null
        : null
    );
    setSelectedImageIndex(0);
    syncedDefaultSelectionProductIdRef.current = product.id;
  }, [product]);

  // Sync quantity with cart store
  const cartItem = (() => {
    if (!product) return undefined;
    return items.find(
      (item) =>
        item.product_id === product.id &&
        (item.variant_id || null) === (effectiveSelectedVariantId || null) &&
        (item.condition || null) === (getConditionDisplay() || null) &&
        (item.color || null) === (effectiveSelectedColor || null) &&
        (item.storage || null) === (effectiveSelectedStorage || null)
    );
  })();

  const quantityInCart = cartItem ? cartItem.quantity : 0;

  // Local state for editable quantity input to allow smooth typing
  const [localQty, setLocalQty] = useState(quantityInCart.toString());

  // Sync local quantity when store changes
  useEffect(() => {
    setLocalQty(quantityInCart.toString());
  }, [quantityInCart]);

  useEffect(() => {
    if (
      isValidSlug &&
      typeof slug === 'string' &&
      product?.slug &&
      product.slug !== slug
    ) {
      router.replace(`/product/${product.slug}`);
    }
  }, [isValidSlug, product?.slug, slug]);

  const handleLocalQtyChange = (text: string) => {
    // Only allow numeric input
    const cleanText = text.replace(/[^0-9]/g, '');
    setLocalQty(cleanText);

    // Auto-update store if it's a valid positive number
    const num = Number.parseInt(cleanText, 10);
    if (!Number.isNaN(num) && num > 0 && cartItem) {
      updateQuantity(cartItem.id, num);
    }
  };

  const handleLocalQtyBlur = () => {
    const num = Number.parseInt(localQty, 10);
    if (Number.isNaN(num) || num <= 0) {
      // Revert to current cart quantity if invalid
      setLocalQty(quantityInCart.toString());
    } else if (cartItem) {
      updateQuantity(cartItem.id, num);
    }
  };

  const [flyingParticles, setFlyingParticles] = useState<
    { id: number; startX: number; startY: number }[]
  >([]);
  const particleIdRef = useRef(0);
  const particleTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // H13 FIX: Clean up all particle timers on unmount
  useEffect(() => {
    const timers = particleTimersRef.current;
    return () => {
      for (const timerId of timers.values()) {
        clearTimeout(timerId);
      }
      timers.clear();
    };
  }, []);

  const triggerFlyToCart = (event: GestureResponderEvent) => {
    // Get position from event (pageX/pageY) or fallback to center
    const { pageX, pageY } = event?.nativeEvent || {};
    const id = ++particleIdRef.current;

    setFlyingParticles((prev) => [
      ...prev,
      {
        id,
        startX: pageX ?? Dimensions.get('window').width / 2,
        startY: pageY ?? Dimensions.get('window').height - 100,
      },
    ]);

    // Cleanup particle after animation, tracked for unmount cleanup
    const timerId = setTimeout(() => {
      setFlyingParticles((prev) => prev.filter((p) => p.id !== id));
      particleTimersRef.current.delete(id);
    }, 1000);
    particleTimersRef.current.set(id, timerId);
  };

  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
    },
  });

  // Animated styles for the parallax image
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.get(),
      [-100, 0],
      [1.2, 1],
      Extrapolate.CLAMP
    );
    const translateY = interpolate(
      scrollY.get(),
      [0, HEADER_HEIGHT],
      [0, -HEADER_HEIGHT * 0.2],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ scale }, { translateY }],
    };
  });

  // Animated styles for the header background
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.get(),
      [HEADER_HEIGHT * 0.5, HEADER_HEIGHT * 0.8],
      [0, 1],
      Extrapolate.CLAMP
    );
    return {
      backgroundColor: colors.card,
      opacity,
    };
  });

  const backButtonAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor =
      scrollY.get() > HEADER_HEIGHT * 0.7
        ? withTiming('transparent')
        : withTiming('rgba(0,0,0,0.3)');
    return { backgroundColor };
  });

  // Effective price hooks — must run unconditionally before early returns
  const { price: effectivePrice, comparePrice: effectiveComparePrice } =
    useEffectivePrice(
      product ?? null,
      effectiveSelectedVariantId,
      effectiveSelectedStorage,
      selectedCondition,
      negotiatedPrice
    );

  // calculatedPrice is the price without negotiation, used in the NegotiationModal
  const { price: calculatedPrice } = useEffectivePrice(
    product ?? null,
    effectiveSelectedVariantId,
    effectiveSelectedStorage,
    selectedCondition,
    null
  );

  // 2026 Critical Fix: Handle invalid slug parameter
  if (!isValidSlug) {
    return (
      <View
        style={[styles.errorContainer, { backgroundColor: colors.background }]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Invalid Product Link
        </Text>
        <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
          This product link is not valid. Please try searching for the product.
        </Text>
        <Pressable
          style={[styles.retryButton, { backgroundColor: BRAND.primary }]}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/')
          }
          accessibilityLabel="Go back to previous screen"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={BRAND.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading product...
        </Text>
      </View>
    );
  }

  if (error || !product) {
    // 2026 Best Practice: Show offline-specific error when not connected
    if (!isOnline) {
      return (
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <OfflineEmptyState
            title="Product Unavailable Offline"
            description="Connect to the internet to view this product. It will auto-retry when your connection is restored."
            onRetry={() => refetch()}
          />
        </View>
      );
    }

    return (
      <View
        style={[styles.errorContainer, { backgroundColor: colors.background }]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Product not found
        </Text>
        <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
          {error || 'This product may no longer be available'}
        </Text>
        <Pressable
          style={[styles.retryButton, { backgroundColor: BRAND.primary }]}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/')
          }
          accessibilityLabel="Go back to previous screen"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Use color-specific images if selected, otherwise default product images
  // BUG-2-001 FIX: Filter null/undefined images and fallback to placeholder
  const rawImages = colorImages?.length
    ? colorImages.filter(Boolean)
    : product.images?.length
      ? product.images.filter(Boolean)
      : [product.image].filter(Boolean);
  const images =
    rawImages.length > 0
      ? rawImages
      : ['https://placehold.co/400x400/f3f4f6/9ca3af?text=No+Image'];

  const discountPercentage = getDiscountPercentage(
    effectivePrice,
    effectiveComparePrice
  );

  const handleAddToCart = (event?: GestureResponderEvent) => {
    if (product.has_variants && !currentVariantSelection) {
      Alert.alert(
        'Select Variant',
        'Choose an available storage option before adding this item to your cart.'
      );
      return;
    }

    haptics.success(); // Haptic feedback for add to cart

    if (event) triggerFlyToCart(event);

    // Build variant_attributes from individual selections
    const variantAttrs: Record<string, string> = {};
    if (effectiveSelectedColor) variantAttrs.color = effectiveSelectedColor;
    if (effectiveSelectedStorage) variantAttrs.storage = effectiveSelectedStorage;
    for (const [axis, value] of Object.entries(effectiveSelectedAttributes)) {
      if (value) {
        variantAttrs[axis] = value;
      }
    }
    const conditionDisplay = getConditionDisplay();
    if (conditionDisplay) variantAttrs.condition = conditionDisplay;

    // Add item with quantity 1
    addItem({
      product_id: product.id,
      slug: product.slug,
      variant_id: effectiveSelectedVariantId || undefined,
      variant_attributes:
        Object.keys(variantAttrs).length > 0 ? variantAttrs : undefined,
      name: product.name,
      price: effectivePrice,
      compare_at_price: effectiveComparePrice,
      quantity: 1,
      image_url: resolveCartItemImageUrl({
        displayedImageUrl: images[selectedImageIndex] || images[0],
        variantImageUrl: currentVariantSelection?.variant.image,
        variantImages: currentVariantSelection?.variant.images,
        fallbackImageUrl: product.image,
      }),
      color: effectiveSelectedColor || undefined,
      storage: effectiveSelectedStorage || undefined,
      condition: conditionDisplay,
      variant_name: currentVariantSelection?.variant.name,
    });

    setShowAddedToast(true);
    // Clear any existing timer before setting a new one (2026 Best Practice)
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setShowAddedToast(false);
      toastTimerRef.current = null;
    }, 2000);
  };

  const handleUpdateQuantity = (
    newQuantity: number,
    event?: GestureResponderEvent
  ) => {
    haptics.light();

    if (newQuantity > quantityInCart && event) {
      triggerFlyToCart(event);
    }

    if (cartItem) {
      if (newQuantity <= 0) {
        removeItem(cartItem.id);
      } else {
        updateQuantity(cartItem.id, newQuantity);
      }
    } else if (newQuantity > 0) {
      handleAddToCart();
    }
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Check out the ${product.name} on Ogabassey: https://ogabassey.com/product/${product.slug}`,
        title: product.name,
      });

      // 2026 Best Practice: Track share action for analytics
      if (result.action === Share.sharedAction) {
        log.info('Product shared successfully');
      }
    } catch (err) {
      // 2026 Best Practice: User feedback on share failure
      log.error('Share error:', err);
      // On iOS, cancelled shares don't throw, but other errors should notify user
      if (err instanceof Error && !err.message.includes('cancel')) {
        Alert.alert(
          'Unable to Share',
          'There was a problem sharing this product. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating Dynamic Header */}
      <Animated.View
        style={[
          styles.header,
          { height: insets.top + 50 },
          headerAnimatedStyle,
        ]}
      >
        <View style={[styles.headerContent, { marginTop: insets.top }]}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {product.name}
          </Text>
        </View>
      </Animated.View>

      {/* Static Header Buttons (Always Visible) */}
      <View style={[styles.headerButtons, { top: insets.top }]}>
        <Animated.View style={[styles.iconCircle, backButtonAnimatedStyle]}>
          <Pressable
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
            hitSlop={12}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
        </Animated.View>
        <View style={styles.headerRight}>
          <Animated.View style={[styles.iconCircle, backButtonAnimatedStyle]}>
            <Pressable
              onPress={() => {
                haptics.light();
                toggleSaved(product);
              }}
              hitSlop={12}
              accessibilityLabel={
                isSaved(product.id)
                  ? `Remove ${product.name} from saved items`
                  : `Save ${product.name} for later`
              }
              accessibilityRole="button"
            >
              <Ionicons
                name={isSaved(product.id) ? 'heart' : 'heart-outline'}
                size={22}
                color={isSaved(product.id) ? '#EF4444' : '#FFF'}
              />
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.iconCircle, backButtonAnimatedStyle]}>
            <Pressable
              onPress={handleShare}
              hitSlop={12}
              accessibilityLabel="Share this product"
              accessibilityRole="button"
            >
              <Ionicons name="share-social-outline" size={22} color="#FFF" />
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Parallax Image Gallery */}
        <ProductImageGallery
          images={images}
          selectedImageIndex={selectedImageIndex}
          setSelectedImageIndex={setSelectedImageIndex}
          imageAnimatedStyle={imageAnimatedStyle}
          showImageZoom={showImageZoom}
          setShowImageZoom={setShowImageZoom}
          discountPercentage={discountPercentage}
          colors={colors}
          headerHeight={HEADER_HEIGHT}
        />

        {/* Product Details Content */}
        <ProductDetailsBody
          product={product}
          effectivePrice={effectivePrice}
          effectiveComparePrice={effectiveComparePrice}
          negotiatedPrice={negotiatedPrice}
          selectedVariant={selectedVariant}
          setSelectedVariant={setSelectedVariant}
          selectedCondition={selectedCondition}
          setSelectedCondition={setSelectedCondition}
          selectedAttributes={effectiveSelectedAttributes}
          selectedColor={selectedColor}
          selectedStorage={selectedStorage}
          onSelectAttribute={(axis, value) => {
            setSelectedAttributes((current) => ({
              ...current,
              [axis]: value,
            }));
            setSelectedVariant(null);
          }}
          onSelectColor={(color, imgs) => {
            setSelectedColor(color);
            setSelectedVariant(null);
            setColorImages(imgs?.length ? imgs : null);
            setSelectedImageIndex(0);
          }}
          onSelectStorage={(storage) => {
            setSelectedStorage(storage);
            setSelectedVariant(null);
          }}
          onOpenNegotiation={() => setShowNegotiationModal(true)}
          reviews={reviews}
          reviewStats={reviewStats}
          reviewsLoading={reviewsLoading}
          hasMoreReviews={hasMoreReviews}
          loadMoreReviews={loadMoreReviews}
          onMarkHelpful={(reviewId) => {
            markReviewHelpful(reviewId, product.id).catch((err) =>
              log.error('Failed to mark review helpful:', err)
            );
          }}
          colors={colors}
        />
      </Animated.ScrollView>

      {/* Sticky Bottom Actions */}
      <StickyBottomActions
        quantityInCart={quantityInCart}
        localQty={localQty}
        onLocalQtyChange={handleLocalQtyChange}
        onLocalQtyBlur={handleLocalQtyBlur}
        onDecrement={(e) => handleUpdateQuantity(quantityInCart - 1, e)}
        onIncrement={(e) => handleUpdateQuantity(quantityInCart + 1, e)}
        onAddToCart={(e) => handleAddToCart(e)}
        colors={colors}
        paddingBottom={insets.bottom + SPACING.md}
      />

      {/* Fly to Cart Particles */}
      {flyingParticles.map((p) => (
        <FlyToCartParticle key={p.id} startX={p.startX} startY={p.startY} />
      ))}

      {/* Cart Added Toast */}
      {showAddedToast && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.toast, { backgroundColor: colors.text }]}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[styles.toastText, { color: colors.background }]}>
            Added to your cart!
          </Text>
        </Animated.View>
      )}

      {/* Saved Items Toast - 2026 Best Practice: User feedback for save actions */}
      {savedToastState.show && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.toast, { backgroundColor: colors.text }]}
        >
          <Ionicons
            name={savedToastState.type === 'add' ? 'heart' : 'heart-dislike'}
            size={20}
            color={
              savedToastState.type === 'add' ? '#EF4444' : colors.background
            }
          />
          <Text style={[styles.toastText, { color: colors.background }]}>
            {savedToastState.message}
          </Text>
        </Animated.View>
      )}

      {/* Negotiation Modal */}
      <NegotiationModal
        visible={showNegotiationModal}
        onClose={() => setShowNegotiationModal(false)}
        productId={product.id}
        merchantId={product.merchant_id || ''}
        productName={product.name}
        currentPrice={calculatedPrice}
        onSuccess={(price) => {
          setNegotiatedPrice(price);
          setShowNegotiationModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 60,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerButtons: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 50,
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toast: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
