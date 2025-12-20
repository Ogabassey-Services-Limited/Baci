/**
 * Product Detail Screen - Elite 2025 Edition
 * - Parallax image header with Reanimated
 * - Dynamic translucent navigation bar
 * - Fluid typography and premium spacing
 * - High-performance image handling via expo-image
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  withTiming,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import Colors, { BRAND, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '@/constants/Colors';
import { BLURHASH_VARIANTS } from '@/components/storefront/ProductCard';
import { useColorScheme } from '@/components/useColorScheme';
import { useProduct } from '@/hooks/use-products';
import { useCartStore } from '@/stores/cart-store';
import { formatPrice, getDiscountPercentage } from '@/types/product';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_HEIGHT = SCREEN_WIDTH; // Square aspect ratio for main image

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { product, isLoading, error } = useProduct(slug || '');
  const addItem = useCartStore((state) => state.addItem);

  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showAddedToast, setShowAddedToast] = useState(false);

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
    const backgroundColor = scrollY.value > HEADER_HEIGHT * 0.7 
      ? withTiming('transparent') 
      : withTiming('rgba(0,0,0,0.3)');
    return { backgroundColor };
  });

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={BRAND.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading product...
        </Text>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Product not found
        </Text>
        <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>
          {error || 'This product may no longer be available'}
        </Text>
        <Pressable
          style={[styles.retryButton, { backgroundColor: BRAND.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const images = product.images?.length ? product.images : [product.image];
  const discountPercentage = getDiscountPercentage(product.price, product.compare_at_price);

  const handleAddToCart = () => {
    addItem({
      product_id: product.id,
      variant_id: selectedVariant || undefined,
      name: product.name,
      price: product.price,
      compare_at_price: product.compare_at_price,
      quantity,
      image_url: product.image,
      condition: product.condition,
    });

    setShowAddedToast(true);
    setTimeout(() => setShowAddedToast(false), 2000);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push('/checkout');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out the ${product.name} on Ogabassey: https://ogabassey.com/product/${product.slug}`,
        title: product.name,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating Dynamic Header */}
      <Animated.View style={[styles.header, { height: insets.top + 50 }, headerAnimatedStyle]}>
        <View style={[styles.headerContent, { marginTop: insets.top }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {product.name}
          </Text>
        </View>
      </Animated.View>

      {/* Static Header Buttons (Always Visible) */}
      <View style={[styles.headerButtons, { top: insets.top }]}>
        <Animated.View style={[styles.iconCircle, backButtonAnimatedStyle]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
        </Animated.View>
        <View style={styles.headerRight}>
          <Animated.View style={[styles.iconCircle, backButtonAnimatedStyle]}>
            <Pressable onPress={() => {}} hitSlop={12}>
              <Ionicons name="heart-outline" size={22} color="#FFF" />
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.iconCircle, backButtonAnimatedStyle]}>
            <Pressable onPress={handleShare} hitSlop={12}>
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
      >
        {/* Parallax Image Gallery */}
        <View style={styles.imageContainer}>
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
        </View>

        {/* Product Details Content */}
        <Animated.View 
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.detailsContainer, { backgroundColor: colors.background }]}
        >
          {/* Thumbnails */}
          {images.length > 1 && (
            <View style={styles.thumbnailsWrapper}>
              <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailsContainer}>
                {images.map((img, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedImageIndex(idx)}
                    style={[
                      styles.thumbnail,
                      { borderColor: selectedImageIndex === idx ? BRAND.primary : colors.border }
                    ]}
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
              <View style={[styles.conditionBadge, { backgroundColor: product.condition === 'New' ? colors.success : colors.warning }]}>
                <Text style={styles.conditionText}>{product.condition}</Text>
              </View>
            )}
          </View>

          {/* Title & Rating */}
          <Text style={[styles.title, { color: colors.text }]}>{product.name}</Text>
          
          <View style={styles.ratingRow}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name="star" size={14} color={s <= 4 ? colors.rating : colors.border} />
              ))}
            </View>
            <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
              4.8 (120 reviews)
            </Text>
          </View>

          {/* Pricing */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: BRAND.primary }]}>
              {formatPrice(product.price)}
            </Text>
            {product.compare_at_price && (
              <Text style={[styles.comparePrice, { color: colors.textSecondary }]}>
                {formatPrice(product.compare_at_price)}
              </Text>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Color/Storage</Text>
              <View style={styles.variantGrid}>
                {product.variants.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => setSelectedVariant(v.id)}
                    style={[
                      styles.variantChip,
                      { borderColor: selectedVariant === v.id ? BRAND.primary : colors.border },
                      selectedVariant === v.id && { backgroundColor: BRAND.primary + '10' }
                    ]}
                  >
                    <Text style={[
                      styles.variantLabel,
                      { color: selectedVariant === v.id ? BRAND.primary : colors.text }
                    ]}>
                      {v.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {product.description || 'No description available for this product.'}
            </Text>
          </View>

          {/* Specs */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Specifications</Text>
              <View style={[styles.specsTable, { borderColor: colors.border }]}>
                {Object.entries(product.specifications).map(([key, val], i) => (
                  <View key={key} style={[styles.specRow, i !== 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={[styles.specKey, { color: colors.textSecondary }]}>{key}</Text>
                    <Text style={[styles.specValue, { color: colors.text }]}>{val as string}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* Sticky Bottom Actions */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.md, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={styles.quantityContainer}>
          <Pressable onPress={() => setQuantity(q => Math.max(1, q - 1))} style={[styles.qtyBtn, { borderColor: colors.border }]}>
            <Ionicons name="remove" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.qtyText, { color: colors.text }]}>{quantity}</Text>
          <Pressable onPress={() => setQuantity(q => q + 1)} style={[styles.qtyBtn, { borderColor: colors.border }]}>
            <Ionicons name="add" size={20} color={colors.text} />
          </Pressable>
        </View>
        <Pressable
          style={[styles.addToCartBtn, { backgroundColor: BRAND.primary }]}
          onPress={handleAddToCart}
        >
          <Text style={styles.addToCartBtnText}>Add to Cart</Text>
        </Pressable>
      </View>

      {/* Elite Toast */}
      {showAddedToast && (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.toast, { backgroundColor: colors.text }]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.toastText}>Added to your cart!</Text>
        </Animated.View>
      )}
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
    height: HEADER_HEIGHT,
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
    borderRadius: 27,
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
});