/**
 * ProductCard Component - Multi-Tenant Template System
 * Supports 'grid', 'editorial', and 'list' layouts with Reanimated motion
 *
 * 2025 Best Practice: "Lush" Hydration
 * - Blurhash placeholders for instant visual feedback
 * - Memory-disk cache policy for image persistence
 * - 300ms smooth transitions from placeholder to image
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors, { BRAND, SPACING, RADIUS, TYPOGRAPHY, SHADOWS, SPRING_CONFIG } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { formatPrice, getDiscountPercentage, type Product } from '@/types/product';
import { useCartStore } from '@/stores/cart-store';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_WIDTH = (SCREEN_WIDTH - 48) / 2;

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
  isWishlisted?: boolean;
  blurhash?: string;
}

// Scarcity threshold - show badge when stock below this number
const LOW_STOCK_THRESHOLD = 5;

export function ProductCard({
  product,
  variant = 'grid',
  onPress,
  onPressIn,
  onWishlistToggle,
  isWishlisted = false,
  blurhash = DEFAULT_BLURHASH,
}: ProductCardProps) {
  const scale = useSharedValue(1);
  const heartScale = useSharedValue(1);
  const addItem = useCartStore((state) => state.addItem);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Real-time stock tracking
  const [stockQuantity, setStockQuantity] = useState<number | undefined>(
    product.stock_quantity
  );
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Subscribe to real-time stock updates
  useEffect(() => {
    // Only subscribe if product has stock tracking
    if (product.stock_quantity === undefined) return;

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
  }, [product.id, product.stock_quantity]);

  // Determine if we should show scarcity badge
  const showScarcityBadge =
    stockQuantity !== undefined &&
    stockQuantity > 0 &&
    stockQuantity < LOW_STOCK_THRESHOLD;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }]
  }));

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/product/${product.slug}`);
    }
  };

  const handleAnimateIn = () => {
    scale.value = withSpring(0.96, SPRING_CONFIG.snappy);
    onPressIn?.();
  };

  const handleAnimateOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG.snappy);
  };

  const handleWishlistPress = () => {
    // Instant feedback - animate heart before callback
    heartScale.value = withSpring(1.3, SPRING_CONFIG.snappy, () => {
      heartScale.value = withSpring(1, SPRING_CONFIG.snappy);
    });
    onWishlistToggle?.(product);
  };

  const handleAddToCart = () => {
    addItem({
      product_id: product.id,
      name: product.name,
      price: product.price,
      compare_at_price: product.compare_at_price,
      quantity: 1,
      image_url: product.image,
      condition: product.condition,
    });
  };

  const discount = getDiscountPercentage(product.price, product.compare_at_price);

  // Common image props for all variants
  const imageProps = {
    placeholder: { blurhash },
    transition: 300,
    cachePolicy: 'memory-disk' as const,
    contentFit: 'cover' as const,
  };

  // --- RENDER: Editorial Variant (Fashion) ---
  if (variant === 'editorial') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handleAnimateIn}
        onPressOut={handleAnimateOut}
        style={[styles.editorialContainer, animatedStyle]}
      >
        <Image
          source={{ uri: product.image }}
          style={styles.editorialImage}
          {...imageProps}
        />
        <View style={styles.editorialContent}>
          <Text style={[styles.editorialName, { color: colors.text }]}>{product.name}</Text>
          <Text style={[styles.editorialPrice, { color: BRAND.primary }]}>{formatPrice(product.price)}</Text>
        </View>
      </AnimatedPressable>
    );
  }

  // --- RENDER: List Variant (Pharma/B2B) ---
  if (variant === 'list') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handleAnimateIn}
        onPressOut={handleAnimateOut}
        style={[styles.listContainer, { borderColor: colors.border }, animatedStyle]}
      >
        <Image
          source={{ uri: product.image }}
          style={styles.listImage}
          {...imageProps}
          contentFit="contain"
        />
        <View style={styles.listContent}>
          <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
          <Text style={[styles.listPrice, { color: colors.price }]}>{formatPrice(product.price)}</Text>
        </View>
        <Pressable onPress={handleAddToCart} style={styles.listAddBtn}>
          <Ionicons name="add" size={24} color={BRAND.primary} />
        </Pressable>
      </AnimatedPressable>
    );
  }

  // --- RENDER: Standard Grid Variant ---
  return (
    <AnimatedPressable
      style={[
        styles.gridContainer,
        { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.black },
        animatedStyle
      ]}
      onPress={handlePress}
      onPressIn={handleAnimateIn}
      onPressOut={handleAnimateOut}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${product.name}`}
      accessibilityHint="Opens the product details screen"
    >
      <View style={[styles.imageWrapper, { backgroundColor: colors.placeholder }]}>
        <Image
          source={{ uri: product.image }}
          style={styles.gridImage}
          {...imageProps}
        />
        {discount && <View style={styles.badge}><Text style={styles.badgeText}>-{discount}%</Text></View>}
        {/* Real-time Scarcity Badge */}
        {showScarcityBadge && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            style={styles.scarcityBadge}
            accessibilityRole="alert"
          >
            <Text style={styles.scarcityText}>
              🔥 Only {stockQuantity} left!
            </Text>
          </Animated.View>
        )}
        <Pressable
          onPress={handleWishlistPress}
          style={[styles.wishlistBtn, { backgroundColor: colors.card }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          accessibilityState={{ selected: isWishlisted }}
        >
          <Animated.View style={heartAnimatedStyle}>
            <Ionicons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={18}
              color={isWishlisted ? BRAND.primary : colors.icon}
            />
          </Animated.View>
        </Pressable>
      </View>
      <View style={styles.gridContent}>
        <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.gridPrice, { color: colors.price }]}>{formatPrice(product.price)}</Text>
          <Pressable 
            onPress={handleAddToCart} 
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Add ${product.name} to cart`}
          >
            <Ionicons name="add-circle" size={24} color={BRAND.primary} />
          </Pressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  gridContainer: { width: GRID_WIDTH, borderRadius: RADIUS.xl, padding: 10, marginBottom: 16, borderWidth: 1, ...SHADOWS.sm },
  imageWrapper: { width: '100%', aspectRatio: 1, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 10 },
  gridImage: { width: '100%', height: '100%' },
  gridContent: { paddingHorizontal: 4 },
  gridName: { fontSize: 13, fontWeight: '600', marginBottom: 6, lineHeight: 18 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gridPrice: { fontSize: 15, fontWeight: '800' },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: BRAND.primary, paddingHorizontal: 6, paddingVertical: 3, borderRadius: RADIUS.sm },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  scarcityBadge: { position: 'absolute', bottom: 8, left: 8, right: 8, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS.sm, alignItems: 'center' },
  scarcityText: { color: '#D97706', fontSize: 11, fontWeight: '700' },
  wishlistBtn: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', ...SHADOWS.sm },

  editorialContainer: { width: SCREEN_WIDTH - 32, marginBottom: 24, marginHorizontal: 16 },
  editorialImage: { width: '100%', aspectRatio: 0.8, borderRadius: RADIUS.md },
  editorialContent: { marginTop: 12, alignItems: 'center' },
  editorialName: { fontSize: 18, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
  editorialPrice: { fontSize: 16, marginTop: 4, fontWeight: '500' },

  listContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, gap: 16 },
  listImage: { width: 60, height: 60, borderRadius: RADIUS.md },
  listContent: { flex: 1 },
  listName: { fontSize: 15, fontWeight: '500' },
  listPrice: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  listAddBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }
});
