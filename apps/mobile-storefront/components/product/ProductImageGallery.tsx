/**
 * ProductImageGallery - Parallax main image with thumbnail strip and zoom modal wiring.
 * Used in the product detail screen header area.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ImageZoomModal } from '@/components/product/ImageZoomModal';
import { BLURHASH_VARIANTS } from '@/components/storefront/ProductCard';
import type Colors from '@/constants/Colors';
import { BRAND, RADIUS } from '@/constants/Colors';

type ColorsScheme = (typeof Colors)['light'];

export interface ProductImageGalleryProps {
  images: string[];
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  imageAnimatedStyle: StyleProp<ViewStyle>;
  showImageZoom: boolean;
  setShowImageZoom: (show: boolean) => void;
  discountPercentage: number | null | undefined;
  colors: ColorsScheme;
  headerHeight: number;
}

export function ProductImageGallery({
  images,
  selectedImageIndex,
  setSelectedImageIndex,
  imageAnimatedStyle,
  showImageZoom,
  setShowImageZoom,
  discountPercentage,
  colors,
  headerHeight,
}: ProductImageGalleryProps) {
  // Local safeIndex state synced with parent via useEffect.
  // This prevents stale renders when the parent's selectedImageIndex
  // falls outside the valid range (e.g. after color-image swap).
  const [safeIndex, setSafeIndex] = useState(() =>
    Math.min(Math.max(0, selectedImageIndex), images.length - 1)
  );

  useEffect(() => {
    const clamped = Math.min(
      Math.max(0, selectedImageIndex),
      images.length - 1
    );
    setSafeIndex(clamped);
  }, [selectedImageIndex, images.length]);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      {/* Main Image */}
      <Pressable
        style={[styles.imageContainer, { height: headerHeight }]}
        onPress={() => setShowImageZoom(true)}
        accessibilityLabel="Tap to zoom product image"
        accessibilityRole="button"
        accessibilityHint="Opens full-screen image viewer with zoom"
      >
        <Animated.View style={[styles.parallaxWrapper, imageAnimatedStyle]}>
          <Image
            source={{ uri: images[safeIndex] }}
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

        {/* Discount Badge */}
        {discountPercentage ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discountPercentage}%</Text>
          </View>
        ) : null}

        {/* Zoom Hint Icon */}
        <View style={styles.zoomHint}>
          <Ionicons name="expand-outline" size={20} color="#FFF" />
        </View>
      </Pressable>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <View style={styles.thumbnailsWrapper}>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailsContainer}
          >
            {images.map((img, idx) => (
              <Pressable
                key={`${img}-${idx}`}
                onPress={() => setSelectedImageIndex(idx)}
                style={[
                  styles.thumbnail,
                  {
                    borderColor:
                      safeIndex === idx ? BRAND.primary : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`View image ${idx + 1} of ${images.length}`}
                accessibilityState={{ selected: safeIndex === idx }}
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

      {/* Image Zoom Modal */}
      <ImageZoomModal
        visible={showImageZoom}
        images={images}
        initialIndex={safeIndex}
        onClose={() => setShowImageZoom(false)}
        onIndexChange={(index) => setSelectedImageIndex(index)}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
});
