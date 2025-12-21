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
        { backgroundColor: '#FFF', borderColor: '#F3F4F6', shadowColor: colors.black },
        animatedStyle
      ]}
      onPress={handlePress}
      onPressIn={handleAnimateIn}
      onPressOut={handleAnimateOut}
    >
      {/* Image Container */}
      <View style={[styles.imageWrapper, { backgroundColor: '#F9FAFB' }]}>
        {/* Wishlist - Top Right */}
        <Pressable
          onPress={handleWishlistPress}
          style={styles.wishlistBtn}
          hitSlop={8}
        >
          <Animated.View style={[heartAnimatedStyle, styles.wishlistBlur]}>
            <Ionicons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={18}
              color={isWishlisted ? BRAND.primary : '#9CA3AF'}
            />
          </Animated.View>
        </Pressable>

        {/* Condition Badge - Top Left */}
        {product.condition && (
          <View style={[styles.badgeContainer,
          product.condition === 'New' ? { backgroundColor: '#111827' } :
            product.condition === 'Open Box' ? { backgroundColor: '#4F46E5' } :
              { backgroundColor: '#78716C' }
          ]}>
            <Text style={styles.badgeText}>{product.condition}</Text>
          </View>
        )}

        {/* Platform Badge - Bottom Left */}
        {product.variant_attributes?.Platform && product.variant_attributes.Platform.length > 0 && (
          <View style={styles.platformBadge}>
            <Text style={styles.platformText}>
              {product.variant_attributes.Platform[0].replace('PlayStation ', 'PS').substring(0, 10)}
            </Text>
          </View>
        )}

        <Image
          source={{ uri: product.image }}
          style={styles.gridImage}
          {...imageProps}
        />

        {/* Floating Cart Button - Bottom Right */}
        <Pressable onPress={handleAddToCart} style={styles.floatingCartBtn}>
          <Ionicons name="cart" size={18} color={BRAND.primary} />
        </Pressable>

        {/* Scarcity Overlay */}
        {showScarcityBadge && (
          <View style={styles.scarcityBadge}>
            <Text style={styles.scarcityText}>Only {stockQuantity} left</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.gridContent}>
        {/* Color Swatches */}
        {product.colors && product.colors.length > 0 && (
          <View style={styles.swatchRow}>
            {product.colors.slice(0, 4).map((c, i) => (
              <View key={i} style={[styles.swatch, { backgroundColor: typeof c === 'string' ? c : c.value }]} />
            ))}
            {product.colors.length > 4 && <Text style={styles.moreColors}>+{product.colors.length - 4}</Text>}
          </View>
        )}

        {/* Title */}
        <Text style={[styles.gridName, { color: '#111827' }]} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Price Row */}
        <View style={styles.priceRow}>
          <Text style={[styles.gridPrice, { color: BRAND.primary }]}>{formatPrice(product.price)}</Text>
          {/* Details Link */}
          <Text style={styles.detailsText}>Details</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    width: GRID_WIDTH,
    borderRadius: RADIUS.xl,
    padding: 8,
    marginBottom: 16,
    borderWidth: 1,
    backgroundColor: '#FFF',
    // Slight shadow
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
    position: 'relative'
  },
  gridImage: { width: '100%', height: '100%' },

  // Badges
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
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  platformBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  platformText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#111827',
    textTransform: 'uppercase'
  },
  scarcityBadge: {
    position: 'absolute',
    top: 30, // Below badge
    left: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 9
  },
  scarcityText: { color: '#D97706', fontSize: 10, fontWeight: '700' },

  // Buttons
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 20,
  },
  wishlistBlur: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingCartBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },

  gridContent: { paddingHorizontal: 4 },
  gridName: {
    fontSize: 13,
    fontFamily: 'serif', // System Serif
    marginBottom: 4,
    lineHeight: 18,
    fontWeight: '500' // Serif normal/medium
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 },
  gridPrice: { fontSize: 16, fontFamily: 'serif', fontWeight: 'bold' },
  detailsText: { fontSize: 11, fontFamily: 'serif', color: '#111827', fontWeight: '600' },

  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1 },
  moreColors: { fontSize: 9, color: '#6B7280', fontWeight: '600' },


  // Existing variants ...
  editorialContainer: { width: SCREEN_WIDTH - 32, marginBottom: 24, marginHorizontal: 16 },
  editorialImage: { width: '100%', aspectRatio: 0.8, borderRadius: RADIUS.md },
  editorialContent: { marginTop: 12, alignItems: 'center' },
  editorialName: { fontSize: 18, fontFamily: 'serif', textTransform: 'uppercase', letterSpacing: 1 },
  editorialPrice: { fontSize: 16, marginTop: 4, fontWeight: '500' },
  listContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, gap: 16 },
  listImage: { width: 60, height: 60, borderRadius: RADIUS.md },
  listContent: { flex: 1 },
  listName: { fontSize: 15, fontFamily: 'serif', fontWeight: '500' },
  listPrice: { fontSize: 14, fontFamily: 'serif', fontWeight: '700', marginTop: 2 },
  listAddBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }
});
