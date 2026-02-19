/**
 * Product Detail Screen - Elite 2025 Edition
 * - Parallax image header with Reanimated
 * - Dynamic translucent navigation bar
 * - Fluid typography and premium spacing
 * - High-performance image handling via expo-image
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProductDetail');

import Animated, {
  Easing,
  Extrapolate,
  FadeIn,
  FadeInDown,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineEmptyState } from '@/components/OfflineNotice';
import { ConditionSelector } from '@/components/product/ConditionSelector';
import { ImageZoomModal } from '@/components/product/ImageZoomModal';
import { NegotiationModal } from '@/components/product/NegotiationModal';
import { ReviewsList } from '@/components/product/ReviewsList';
import { VariantSelector } from '@/components/product/VariantSelector';
import { BLURHASH_VARIANTS } from '@/components/storefront/ProductCard';
import { HTMLRenderer } from '@/components/ui/HTMLRenderer';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SHADOWS, SPACING } from '@/constants/Colors';
import { useHaptics } from '@/hooks/use-haptics';
import { useNetworkState } from '@/hooks/use-network-state';
import { useProduct } from '@/hooks/use-products';
import { markReviewHelpful, useReviews } from '@/hooks/use-reviews';
import { useCartStore } from '@/stores/cart-store';
import { useSavedStore } from '@/stores/saved-store';
import type { ProductCondition } from '@/types/product';
import { formatPrice, getDiscountPercentage } from '@/types/product';

// Tab bar layout constants for fly-to-cart animation targeting
const CART_TAB_INDEX = 2; // Cart is the 3rd tab (0-indexed)
const TAB_COUNT = 4; // Total number of tabs

// C4 FIX: Extracted FlyToCartParticle outside ProductDetailScreen to prevent re-creation on every render
function FlyToCartParticle({
  startX,
  startY,
}: {
  startX: number;
  startY: number;
}) {
  const progress = useSharedValue(0);
  const particleInsets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const targetX = (width / TAB_COUNT) * CART_TAB_INDEX + width / TAB_COUNT / 2; // Center of cart tab
  const targetY = height - (particleInsets.bottom + 30); // Tab bar center

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 800,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [startX, targetX]);
    const translateY = interpolate(progress.value, [0, 1], [startY, targetY]);
    const scale = interpolate(progress.value, [0, 0.5, 1], [1, 1.2, 0.2]);
    const opacity = interpolate(progress.value, [0, 0.8, 1], [1, 1, 0]);

    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: BRAND.primary,
      zIndex: 9999,
      transform: [
        { translateX: translateX - 20 },
        { translateY: translateY - 20 },
        { scale },
      ],
      opacity,
    };
  });

  return <Animated.View style={animatedStyle} />;
}

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // L3 FIX: Use useWindowDimensions hook instead of module-level Dimensions.get
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const HEADER_HEIGHT = SCREEN_WIDTH; // Square aspect ratio for main image

  // 2026 Critical Fix: Validate slug parameter early
  const isValidSlug = Boolean(
    slug && typeof slug === 'string' && slug.length > 0
  );

  // 2026 Best Practice: Network state monitoring for offline UX
  const { isOnline, onReconnect } = useNetworkState();

  // 2026 Best Practice: Haptic feedback for tactile UX
  const haptics = useHaptics();

  // Only fetch if we have a valid slug
  const { product, isLoading, error, refetch } = useProduct(
    isValidSlug ? slug : ''
  );
  const { items, addItem, updateQuantity, removeItem } = useCartStore();
  const toggleSaved = useSavedStore((state) => state.toggleSaved);
  const isSaved = useSavedStore((state) => state.isSaved);
  const savedToastState = useSavedStore((state) => state.toastState);
  const dismissSavedToast = useSavedStore((state) => state.dismissToast);

  // Auto-retry fetching product when network is restored
  useEffect(() => {
    return onReconnect(() => {
      if (error || !product) {
        refetch();
      }
    });
  }, [onReconnect, error, product, refetch]);

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
  const [colorImages, setColorImages] = useState<string[] | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [negotiatedPrice, setNegotiatedPrice] = useState<number | null>(null);
  const [showImageZoom, setShowImageZoom] = useState(false);

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
      const conditionMap: Record<ProductCondition, string> = {
        new: 'New',
        used: 'Used',
        uk_used: 'UK Used',
        open_box: 'Open Box',
        refurbished: 'Refurbished',
      };
      return conditionMap[selectedCondition];
    }
    return product?.condition;
  };

  // Sync quantity with cart store
  const cartItem = (() => {
    if (!product) return undefined;
    return items.find(
      (item) =>
        item.product_id === product.id &&
        (item.variant_id || null) === (selectedVariant || null) &&
        (item.condition || null) === (getConditionDisplay() || null) &&
        (item.color || null) === (selectedColor || null) &&
        (item.storage || null) === (selectedStorage || null)
    );
  })();

  const quantityInCart = cartItem ? cartItem.quantity : 0;

  // Local state for editable quantity input to allow smooth typing
  const [localQty, setLocalQty] = useState(quantityInCart.toString());

  // Sync local quantity when store changes
  useEffect(() => {
    setLocalQty(quantityInCart.toString());
  }, [quantityInCart]);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triggerFlyToCart = (event: any) => {
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
      scrollY.value = event.contentOffset.y;
    },
  });

  // Animated styles for the parallax image
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [-100, 0],
      [1.2, 1],
      Extrapolate.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
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
      scrollY.value,
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
      scrollY.value > HEADER_HEIGHT * 0.7
        ? withTiming('transparent')
        : withTiming('rgba(0,0,0,0.3)');
    return { backgroundColor };
  });

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

  // Calculate effective price based on selected condition, storage, and variant
  const calculateEffectivePrice = () => {
    let price = product.price;
    let comparePrice = product.compare_at_price;

    // Apply condition price if different condition selected
    if (selectedCondition && product.offers) {
      const offer = product.offers.find(
        (o) => o.condition === selectedCondition
      );
      if (offer) {
        price = offer.price;
        comparePrice = offer.compare_at_price;
      }
    }

    // Apply storage-based variant price modifier
    if (selectedStorage && product.variants) {
      const variant = product.variants.find(
        (v) =>
          v.attributes?.storage === selectedStorage ||
          v.name?.includes(selectedStorage)
      );
      if (variant) {
        if (variant.price_override !== undefined) {
          price = variant.price_override;
        } else if (variant.price_modifier !== undefined) {
          price += variant.price_modifier;
        }
      }
    }

    // Apply variant price modifier if variant selected (fallback for legacy)
    if (selectedVariant && product.variants) {
      const variant = product.variants.find((v) => v.id === selectedVariant);
      if (variant) {
        if (variant.price_override !== undefined) {
          price = variant.price_override;
        } else if (variant.price_modifier !== undefined) {
          price += variant.price_modifier;
        }
      }
    }

    return { price, comparePrice };
  };

  const { price: calculatedPrice, comparePrice: effectiveComparePrice } =
    calculateEffectivePrice();

  // M11 FIX: Use ?? instead of || so negotiatedPrice of 0 is not treated as falsy
  const effectivePrice = negotiatedPrice ?? calculatedPrice;

  const discountPercentage = getDiscountPercentage(
    effectivePrice,
    effectiveComparePrice
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAddToCart = (event?: any) => {
    haptics.success(); // Haptic feedback for add to cart

    if (event) triggerFlyToCart(event);

    // Add item with quantity 1
    addItem({
      product_id: product.id,
      slug: product.slug,
      variant_id: selectedVariant || undefined,
      name: product.name,
      price: effectivePrice,
      compare_at_price: effectiveComparePrice,
      quantity: 1,
      image_url: images[0] || product.image,
      color: selectedColor || undefined,
      storage: selectedStorage || undefined,
      condition: getConditionDisplay(),
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdateQuantity = (newQuantity: number, event?: any) => {
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
        <Pressable
          style={[styles.imageContainer, { height: HEADER_HEIGHT }]}
          onPress={() => setShowImageZoom(true)}
          accessibilityLabel="Tap to zoom product image"
          accessibilityRole="button"
          accessibilityHint="Opens full-screen image viewer with zoom"
        >
          <Animated.View style={[styles.parallaxWrapper, imageAnimatedStyle]}>
            <Image
              source={{ uri: images[selectedImageIndex] }}
              style={styles.mainImage}
              contentFit="cover"
              transition={300}
              placeholder={{ blurhash: BLURHASH_VARIANTS.default }}
              cachePolicy="memory-disk"
            />
          </Animated.View>
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'transparent']}
            style={StyleSheet.absoluteFill}
          />

          {/* Badge */}
          {discountPercentage && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discountPercentage}%</Text>
            </View>
          )}

          {/* Zoom Hint Icon */}
          <View style={styles.zoomHint}>
            <Ionicons name="expand-outline" size={20} color="#FFF" />
          </View>
        </Pressable>

        {/* Product Details Content */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[
            styles.detailsContainer,
            { backgroundColor: colors.background },
          ]}
        >
          {/* Thumbnails */}
          {images.length > 1 && (
            <View style={styles.thumbnailsWrapper}>
              <Animated.ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailsContainer}
              >
                {images.map((img, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedImageIndex(idx)}
                    style={[
                      styles.thumbnail,
                      {
                        borderColor:
                          selectedImageIndex === idx
                            ? BRAND.primary
                            : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`View image ${idx + 1} of ${images.length}`}
                    accessibilityState={{
                      selected: selectedImageIndex === idx,
                    }}
                    accessibilityHint="Double tap to show this image in the main view"
                  >
                    <Image
                      source={{ uri: img }}
                      style={styles.thumbnailImage}
                      contentFit="cover"
                      placeholder={{ blurhash: BLURHASH_VARIANTS.default }}
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  </Pressable>
                ))}
              </Animated.ScrollView>
            </View>
          )}

          {/* Meta Info */}
          <View style={styles.metaRow}>
            {product.brand && (
              <Text style={[styles.brandText, { color: colors.textSecondary }]}>
                {product.brand}
              </Text>
            )}
            {product.condition && (
              <View
                style={[
                  styles.conditionBadge,
                  {
                    backgroundColor:
                      product.condition === 'New'
                        ? colors.success
                        : colors.warning,
                  },
                ]}
              >
                <Text style={styles.conditionText}>{product.condition}</Text>
              </View>
            )}
          </View>

          {/* Title & Rating */}
          <Text style={[styles.title, { color: colors.text }]}>
            {product.name}
          </Text>

          <View style={styles.ratingRow}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => {
                const rating =
                  reviewStats?.average_rating ?? product.rating ?? 4.5;
                return (
                  <Ionicons
                    key={s}
                    name={s <= Math.round(rating) ? 'star' : 'star-outline'}
                    size={14}
                    color={
                      s <= Math.round(rating) ? colors.rating : colors.border
                    }
                  />
                );
              })}
            </View>
            <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
              {typeof reviewStats?.average_rating === 'number' &&
              Number.isFinite(reviewStats.average_rating)
                ? `${reviewStats.average_rating.toFixed(1)} (${reviewStats.review_count ?? 0} reviews)`
                : product.rating
                  ? `${product.rating} (${product.review_count || 0} reviews)`
                  : 'No reviews yet'}
            </Text>
          </View>

          {/* Pricing */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: BRAND.primary }]}>
              {formatPrice(effectivePrice)}
            </Text>
            {effectiveComparePrice &&
              effectiveComparePrice > effectivePrice && (
                <Text
                  style={[styles.comparePrice, { color: colors.textSecondary }]}
                >
                  {formatPrice(effectiveComparePrice)}
                </Text>
              )}
          </View>

          {/* Negotiated Price Badge */}
          {/* M11 FIX: Use != null instead of truthy check so price of 0 is handled */}
          {negotiatedPrice != null && (
            <View style={styles.negotiatedBadge}>
              <Ionicons name="pricetag" size={14} color="#10B981" />
              <Text style={styles.negotiatedText}>Your negotiated price!</Text>
            </View>
          )}

          {/* Make an Offer Button */}
          {negotiatedPrice == null && (
            <Pressable
              style={[styles.makeOfferButton, { borderColor: BRAND.primary }]}
              onPress={() => setShowNegotiationModal(true)}
            >
              <Ionicons
                name="chatbubble-outline"
                size={16}
                color={BRAND.primary}
              />
              <Text style={[styles.makeOfferText, { color: BRAND.primary }]}>
                Make an Offer
              </Text>
            </Pressable>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Condition Selector */}
          {product.has_condition_offers && product.offers && (
            <ConditionSelector
              currentCondition={product.condition}
              offers={product.offers}
              selectedCondition={selectedCondition}
              onSelect={setSelectedCondition}
              basePrice={product.price}
            />
          )}

          {/* Advanced Variant Selection */}
          {(product.colors ||
            product.color_images ||
            product.variant_attributes?.storage ||
            product.variants?.some((v) => v.attributes?.storage)) && (
            <View style={styles.section}>
              <VariantSelector
                colors={product.colors}
                colorImages={product.color_images}
                storage={
                  product.variant_attributes?.storage ||
                  product.variants
                    ?.map((v) => v.attributes?.storage)
                    .filter((s): s is string => !!s)
                }
                variants={product.variants}
                selectedColor={selectedColor}
                selectedStorage={selectedStorage}
                onSelectColor={(color, imgs) => {
                  setSelectedColor(color);
                  setColorImages(imgs?.length ? imgs : null);
                  setSelectedImageIndex(0);
                }}
                onSelectStorage={setSelectedStorage}
                basePrice={effectivePrice}
              />
            </View>
          )}

          {/* Legacy Variants (fallback for products without colors/storage) */}
          {product.variants &&
            product.variants.length > 0 &&
            !product.colors &&
            !product.color_images &&
            !product.variants.some((v) => v.attributes?.storage) && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Options
                </Text>
                <View style={styles.variantGrid}>
                  {product.variants.map((v) => (
                    <Pressable
                      key={v.id}
                      onPress={() => setSelectedVariant(v.id)}
                      style={[
                        styles.variantChip,
                        {
                          borderColor:
                            selectedVariant === v.id
                              ? BRAND.primary
                              : colors.border,
                        },
                        selectedVariant === v.id && {
                          backgroundColor: `${BRAND.primary}10`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.variantLabel,
                          {
                            color:
                              selectedVariant === v.id
                                ? BRAND.primary
                                : colors.text,
                          },
                        ]}
                      >
                        {v.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Description
            </Text>
            {product.description ? (
              <HTMLRenderer html={product.description} />
            ) : (
              <Text
                style={[styles.description, { color: colors.textSecondary }]}
              >
                No description available for this product.
              </Text>
            )}
          </View>

          {/* Specs */}
          {product.specifications &&
            Object.keys(product.specifications).length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Specifications
                </Text>
                <View
                  style={[styles.specsTable, { borderColor: colors.border }]}
                >
                  {Object.entries(product.specifications).map(
                    ([key, val], i) => (
                      <View
                        key={key}
                        style={[
                          styles.specRow,
                          i !== 0 && {
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.specKey,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {key}
                        </Text>
                        <Text
                          style={[styles.specValue, { color: colors.text }]}
                        >
                          {val as string}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            )}

          {/* Reviews Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Customer Reviews
            </Text>
            <ReviewsList
              reviews={reviews}
              stats={reviewStats}
              isLoading={reviewsLoading}
              hasMore={hasMoreReviews}
              onLoadMore={loadMoreReviews}
              onMarkHelpful={(reviewId) => {
                // Mark review as helpful
                markReviewHelpful(reviewId, product.id).catch((err) =>
                  log.error('Failed to mark review helpful:', err)
                );
              }}
            />
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* Sticky Bottom Actions */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + SPACING.md,
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Animated.View
          layout={LinearTransition.springify().damping(18).stiffness(120)}
          style={{ width: '100%' }}
        >
          {quantityInCart > 0 ? (
            <View
              key="cart-active"
              style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 0 }}
            >
              {/* Quantity Controller */}
              <View
                style={{
                  flex: 1.2,
                  height: 56,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FFF',
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: BRAND.primary,
                }}
              >
                <Pressable
                  onPress={(e) => handleUpdateQuantity(quantityInCart - 1, e)}
                  style={{
                    width: 50,
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRightWidth: 1,
                    borderRightColor: '#FEE2E2',
                  }}
                  hitSlop={10}
                  accessibilityLabel={
                    quantityInCart === 1
                      ? 'Remove from cart'
                      : 'Decrease quantity'
                  }
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={quantityInCart === 1 ? 'trash-outline' : 'remove'}
                    size={22}
                    color={BRAND.primary}
                  />
                </Pressable>

                <View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      color: '#9CA3AF',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: -2,
                    }}
                  >
                    In Cart
                  </Text>
                  <TextInput
                    style={{
                      fontSize: 18,
                      fontWeight: '800',
                      color: '#111827',
                      textAlign: 'center',
                      minWidth: 40,
                      padding: 0,
                      margin: 0,
                    }}
                    value={localQty}
                    onChangeText={handleLocalQtyChange}
                    onBlur={handleLocalQtyBlur}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </View>

                <Pressable
                  onPress={(e) => handleUpdateQuantity(quantityInCart + 1, e)}
                  style={{
                    width: 50,
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderLeftWidth: 1,
                    borderLeftColor: '#FEE2E2',
                  }}
                  hitSlop={10}
                  accessibilityLabel="Increase quantity"
                  accessibilityRole="button"
                >
                  <Ionicons name="add" size={22} color={BRAND.primary} />
                </Pressable>
              </View>

              {/* View Cart Button */}
              <Pressable
                onPress={() => router.push('/(tabs)/cart')}
                style={{
                  flex: 1,
                  height: 56,
                  backgroundColor: BRAND.primary,
                  borderRadius: 12,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  ...SHADOWS.md,
                }}
              >
                <Ionicons name="cart-outline" size={20} color="#FFF" />
                <Text
                  style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}
                >
                  View Cart
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              key="cart-empty"
              style={[styles.addToCartBtn, { backgroundColor: BRAND.primary }]}
              onPress={(e) => handleAddToCart(e)}
            >
              <Ionicons
                name="cart-outline"
                size={22}
                color="#FFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.addToCartBtnText}>Add to Cart</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>

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
          <Text style={styles.toastText}>Added to your cart!</Text>
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
              savedToastState.type === 'add' ? '#EF4444' : colors.textSecondary
            }
          />
          <Text style={styles.toastText}>{savedToastState.message}</Text>
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

      {/* Image Zoom Modal */}
      <ImageZoomModal
        visible={showImageZoom}
        images={images}
        initialIndex={selectedImageIndex}
        onClose={() => setShowImageZoom(false)}
        onIndexChange={(index) => setSelectedImageIndex(index)}
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
  imageContainer: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  parallaxWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 110,
    left: 16,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  discountText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 40,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    borderTopLeftRadius: RADIUS['3xl'],
    borderTopRightRadius: RADIUS['3xl'],
    marginTop: -RADIUS['3xl'],
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  thumbnailsWrapper: {
    marginBottom: 24,
  },
  thumbnailsContainer: {
    gap: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  conditionText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 24,
  },
  price: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontWeight: '900',
  },
  comparePrice: {
    fontSize: 18,
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  variantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  variantChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
  },
  variantLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  specsTable: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  specKey: {
    fontSize: 14,
    fontWeight: '500',
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
    borderTopWidth: 1,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  addToCartBtn: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  addToCartBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
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
    ...SHADOWS.lg,
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  negotiatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  negotiatedText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  makeOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    marginBottom: 16,
  },
  makeOfferText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
