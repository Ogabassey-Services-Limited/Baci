/**
 * ProductCard Component - Multi-Tenant Template System
 * Supports 'grid', 'editorial', and 'list' layouts with Reanimated motion
 *
 * 2025 Best Practice: "Lush" Hydration
 * - Blurhash placeholders for instant visual feedback
 * - Memory-disk cache policy for image persistence
 * - 300ms smooth transitions from placeholder to image
 */

import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPRING_CONFIG } from '@/constants/Colors';
import { useHaptics } from '@/hooks/use-haptics';
import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/stores/cart-store';
import { useSavedStore } from '@/stores/saved-store';
import { formatPrice, type Product } from '@/types/product';

/**
 * Safely sanitize product descriptions for display as plain text.
 * Escapes angle brackets so HTML-like content cannot be interpreted as markup.
 */
export function sanitizeDescriptionPlainText(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Default Blurhash for product images (warm neutral)
// This creates a smooth gradient that works well with most product photos
const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7RjE1%MWBR*';

// Alternative blurhash options by category
export const BLURHASH_VARIANTS = {
  default: 'L6PZfSi_.AyE_3t7t7RjE1%MWBR*',
  electronics: 'L5H2EC=PM+yV0g-mq.wG9c010J}I', // Cool blue/gray
  fashion: 'L8N]~R9G.TtQ~B9at7WC02M{9aIA', // Warm cream
  food: 'L9Ry;S~V.A-;~W9uM{IURiE2E3s:', // Appetizing orange
  beauty: 'LBP?syt7~pt7~WofM{fQ~ps:9ZWB', // Soft pink
} as const;

interface ProductCardProps {
  product: Product;
  variant?: 'grid' | 'editorial' | 'list';
  onPress?: () => void;
  onPressIn?: () => void;
  onWishlistToggle?: (product: Product) => void;
  blurhash?: string;
}

// Scarcity threshold - show badge when stock below this number

/**
 * BUG-2-009 FIX: REMOVE React.memo per ADR-004 (React Compiler handles memoization)
 * React Compiler automatically memoizes components - manual memo is redundant and can
 * interfere with compiler optimizations.
 */
export function ProductCard({
  product,
  variant = 'grid',
  onPress,
  onPressIn,
  onWishlistToggle,
  blurhash = DEFAULT_BLURHASH,
}: ProductCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const gridWidth = (screenWidth - 48) / 2;

  const scale = useSharedValue(1);
  const heartScale = useSharedValue(1);
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);
  const toggleSaved = useSavedStore((state) => state.toggleSaved);

  // 2026 Best Practice: Reactive selector for store state
  // This ensures the component re-renders immediately when this specific product's saved status changes
  const isSaved = useSavedStore((state) =>
    state.items.some((item) => String(item.product_id) === String(product.id))
  );

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // BUG-5-018 FIX: Add haptic feedback hook
  const haptics = useHaptics();

  // 2026 Best Practice: Calculate counts from store to show in UI
  const cartItemCount = cartItems
    .filter((item) => item.product_id === product.id)
    .reduce((total, item) => total + item.quantity, 0);

  // Real-time stock tracking
  const [, setStockQuantity] = useState<number | undefined>(
    product.stock_quantity
  );
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Subscribe to real-time stock updates
  // M13 FIX: Only depend on product.id to prevent infinite re-subscribe loop.
  // product.stock_quantity was causing re-subscription on every stock change.
  const hasStockTracking =
    product.manage_stock === true && product.stock_quantity !== undefined;
  useEffect(() => {
    // Only subscribe if product has stock tracking
    if (!hasStockTracking) return;

    const channel = supabase
      .channel(`product-stock-${product.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `id=eq.${product.id}`,
        },
        (payload) => {
          if (payload.new && 'stock_quantity' in payload.new) {
            setStockQuantity(payload.new.stock_quantity as number);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [product.id, hasStockTracking]);

  // Determine if we should show scarcity badge

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.get() }],
  }));

  const handlePress = () => {
    // BUG-2-006 FIX: Guard against missing slug
    if (!product.slug) return;

    if (onPress) {
      onPress();
    } else {
      router.push(`/product/${product.slug}`);
    }
  };

  const handleAnimateIn = () => {
    scale.set(withSpring(0.96, SPRING_CONFIG.snappy));
    onPressIn?.();
  };

  const handleAnimateOut = () => {
    scale.set(withSpring(1, SPRING_CONFIG.snappy));
  };

  const handleWishlistPress = () => {
    // Instant feedback - animate heart before callback
    heartScale.set(
      withSpring(1.3, SPRING_CONFIG.snappy, () => {
        heartScale.set(withSpring(1, SPRING_CONFIG.snappy));
      })
    );

    // Toggle in store
    toggleSaved(product);

    // Call legacy prop if exists
    onWishlistToggle?.(product);
  };

  const handleAddToCart = () => {
    // BUG-5-018 FIX: Add light haptic feedback on add-to-cart
    haptics.light();

    addItem({
      product_id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      compare_at_price: product.compare_at_price,
      quantity: 1,
      image_url: product.image,
      condition: product.condition,
    });
  };

  // Calculate discount percentage for potential use in badges/promotions

  // 2026 Best Practice: Track image load failures for fallback rendering
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);

  // Common image props for all variants
  // 2026 Best Practice: iOS 26 CoreGraphics has stricter image format requirements
  // - recyclingKey helps with memory management during list scrolling
  // - onError gracefully handles corrupt/incompatible images (rdar://143602439)
  // - allowDownscaling reduces memory pressure on large images
  const imageProps = {
    placeholder: { blurhash },
    transition: 300,
    cachePolicy: 'memory-disk' as const,
    contentFit: 'cover' as const,
    recyclingKey: product.id,
    allowDownscaling: true,
    onError: () => {
      // Silently handle image decode failures (iOS 26 24-bpp bug)
      if (!imageError) {
        setImageError(true);
      } else if (!fallbackError) {
        // Fallback URL also failed; stop trying remote URLs
        setFallbackError(true);
      }
    },
  };

  // Fallback to blurhash placeholder if image fails to load
  // If the fallback URL also fails, skip the Image entirely (render a local placeholder)
  const imageSource =
    imageError && !fallbackError
      ? {
          uri: `https://placehold.co/400x400/1a1a1a/ffffff?text=${encodeURIComponent(product.name?.charAt(0) || 'P')}`,
        }
      : { uri: product.image };

  // --- RENDER: Editorial Variant (Fashion) ---
  if (variant === 'editorial') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handleAnimateIn}
        onPressOut={handleAnimateOut}
        style={[
          styles.editorialContainer,
          { width: screenWidth - 32 },
          animatedStyle,
        ]}
        accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}
        accessibilityRole="button"
      >
        {fallbackError ? (
          <View style={[styles.editorialImage, styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
            <Ionicons name="image-outline" size={40} color={colors.icon} />
          </View>
        ) : (
          <Image
            source={imageSource}
            style={styles.editorialImage}
            {...imageProps}
          />
        )}
        <View style={styles.editorialContent}>
          <Text style={[styles.editorialName, { color: colors.text }]}>
            {product.name}
          </Text>
          <Text style={[styles.editorialPrice, { color: BRAND.primary }]}>
            {formatPrice(product.price)}
          </Text>
        </View>
      </AnimatedPressable>
    );
  }

  // --- RENDER: List Variant (Pharma/B2B/Elite) ---
  if (variant === 'list') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handleAnimateIn}
        onPressOut={handleAnimateOut}
        style={[
          styles.listContainer,
          { borderColor: colors.border },
          animatedStyle,
        ]}
        accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}
        accessibilityRole="button"
      >
        {fallbackError ? (
          <View style={[styles.listImage, styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
            <Ionicons name="image-outline" size={32} color={colors.icon} />
          </View>
        ) : (
          <Image
            source={imageSource}
            style={[styles.listImage, { backgroundColor: colors.muted }]}
            {...imageProps}
          />
        )}
        <View style={styles.listContent}>
          {/* Rating */}
          <View style={styles.ratingRowMini}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={
                  s <= Math.floor(product.rating || 0) ? 'star' : 'star-outline'
                }
                size={10}
                color={colors.rating}
              />
            ))}
          </View>

          <Text
            style={[styles.listName, { color: colors.text }]}
            numberOfLines={1}
          >
            {product.name}
          </Text>

          {product.description && (
            <Text style={[styles.listDescription, { color: colors.textSecondary }]} numberOfLines={2}>
              {sanitizeDescriptionPlainText(
                product.description || ''
              ).substring(0, 100)}
            </Text>
          )}

          <View style={styles.listFooter}>
            <Text style={[styles.listPrice, { color: BRAND.primary }]}>
              {formatPrice(product.price)}
            </Text>
            <Pressable
              onPress={handleAddToCart}
              style={[styles.listCartBtn, { backgroundColor: colors.text }]}
              hitSlop={8}
              accessibilityLabel={`Add ${product.name} to cart`}
              accessibilityRole="button"
            >
              <View style={{ position: 'relative' }}>
                <Ionicons name="cart" size={16} color={colors.background} />
                {cartItemCount > 0 && (
                  <View style={[styles.listBadge, { borderColor: colors.border }]}>
                    <Text style={[styles.badgeTextMini, { color: colors.background }]}>{cartItemCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.listCartLabel, { color: colors.background }]}>Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Wishlist in List View */}
        <Pressable
          onPress={handleWishlistPress}
          style={styles.listWishlistBtn}
          hitSlop={8}
          accessibilityLabel={
            isSaved
              ? `Remove ${product.name} from saved items`
              : `Save ${product.name} for later`
          }
          accessibilityRole="button"
        >
          <Ionicons
            name={isSaved ? 'heart' : 'heart-outline'}
            size={18}
            color={isSaved ? colors.destructive : colors.icon}
          />
        </Pressable>
      </AnimatedPressable>
    );
  }

  // --- RENDER: Standard Grid Variant ---
  return (
    <AnimatedPressable
      style={[
        styles.gridContainer,
        {
          width: gridWidth,
          shadowColor: colors.black,
        },
        animatedStyle,
      ]}
      onPress={handlePress}
      onPressIn={handleAnimateIn}
      onPressOut={handleAnimateOut}
      accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}
      accessibilityRole="button"
    >
      {/* Image Container */}
      <View style={[styles.imageWrapper, { backgroundColor: colors.muted }]}>
        {/* Wishlist - Top Right */}
        <Pressable
          onPress={handleWishlistPress}
          style={styles.wishlistBtn}
          hitSlop={8}
          accessibilityLabel={
            isSaved
              ? `Remove ${product.name} from saved items`
              : `Save ${product.name} for later`
          }
          accessibilityRole="button"
        >
          <Animated.View style={[heartAnimatedStyle, styles.wishlistBlur, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}>
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={18}
              color={isSaved ? colors.destructive : colors.icon}
            />
          </Animated.View>
        </Pressable>

        {/* Condition Badge */}
        {product.condition && (
          <View
            style={[
              styles.badgeContainer,
              product.condition === 'New'
                ? { backgroundColor: colors.text }
                : { backgroundColor: colors.primary },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.background }]}>{product.condition}</Text>
          </View>
        )}

        {fallbackError ? (
          <View style={[styles.gridImage, styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
            <Ionicons name="image-outline" size={40} color={colors.icon} />
          </View>
        ) : (
          <Image
            source={imageSource}
            style={styles.gridImage}
            {...imageProps}
          />
        )}

        {/* Floating Cart Button */}
        <Pressable
          onPress={handleAddToCart}
          style={[styles.floatingCartBtn, { borderColor: colors.border }]}
          accessibilityLabel={`Add ${product.name} to cart`}
          accessibilityRole="button"
        >
          <Ionicons name="cart" size={18} color={BRAND.primary} />
          {cartItemCount > 0 && (
            <View style={[styles.cartBadge, { borderColor: colors.card }]}>
              <Text style={[styles.badgeTextMini, { color: colors.background }]}>{cartItemCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.gridContent}>
        {/* Rating Row */}
        <View style={styles.ratingRowMini}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={
                s <= Math.floor(product.rating || 0) ? 'star' : 'star-outline'
              }
              size={10}
              color={colors.rating}
            />
          ))}
          <Text style={[styles.ratingTextMini, { color: colors.textSecondary }]}>({product.rating || 0})</Text>
        </View>

        {/* Title */}
        <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Price Row */}
        <View style={[styles.priceRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.gridPrice, { color: BRAND.primary }]}>
            {formatPrice(product.price)}
          </Text>
          <Text style={[styles.detailsText, { color: colors.text }]}>Details</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    borderRadius: RADIUS.xl,
    padding: 8,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
  },
  gridImage: { width: '100%', height: '100%' },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    zIndex: 10,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 20,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wishlistBlur: {
    // 2026 Critical Fix: Meet WCAG 2.5.5 minimum touch target size of 44px
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingCartBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    // 2026 Critical Fix: Meet WCAG 2.5.5 minimum touch target size of 44px
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    },
  gridContent: { paddingHorizontal: 4 },
  gridName: {
    fontSize: 13,
    fontFamily: 'serif',
    marginBottom: 4,
    lineHeight: 18,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  gridPrice: { fontSize: 16, fontFamily: 'serif', fontWeight: 'bold' },
  detailsText: {
    fontSize: 11,
    fontFamily: 'serif',
    fontWeight: '600',
  },
  ratingRowMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 4,
  },
  ratingTextMini: {
    fontSize: 10,
    marginLeft: 4,
    fontWeight: '600',
  },

  // LIST VARIANT
  listContainer: {
    flexDirection: 'row',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    gap: 16,
    alignItems: 'center',
  },
  listImage: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.lg,
    },
  listContent: {
    flex: 1,
  },
  listName: {
    fontSize: 16,
    fontFamily: 'serif',
    fontWeight: '700',
    marginBottom: 4,
  },
  listDescription: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listPrice: {
    fontSize: 18,
    fontFamily: 'serif',
    fontWeight: '800',
  },
  listCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  listCartLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  listWishlistBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  editorialContainer: {
    marginBottom: 24,
    marginHorizontal: 16,
  },
  editorialImage: { width: '100%', aspectRatio: 0.8, borderRadius: RADIUS.md },
  editorialContent: { marginTop: 12, alignItems: 'center' },
  editorialName: {
    fontSize: 18,
    fontFamily: 'serif',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  editorialPrice: { fontSize: 16, marginTop: 4, fontWeight: '500' },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: BRAND.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 2,
  },
  listBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: BRAND.primary,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    },
  badgeTextMini: {
    fontSize: 8,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
  },
});
