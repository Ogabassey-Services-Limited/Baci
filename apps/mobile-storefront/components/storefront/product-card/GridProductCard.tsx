import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { BRAND } from '@/constants/Colors';
import { formatPrice } from '@/types/product';
import styles from '../ProductCard.styles';
import type { GridProductCardProps } from './types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function GridProductCard({
  product,
  imageSource,
  imageProps,
  showLocalPlaceholder,
  handlePress,
  handleAnimateIn,
  handleAnimateOut,
  handleWishlistPress,
  handleAddToCart,
  isSaved,
  cartItemCount,
  animatedStyle,
  heartAnimatedStyle,
  gridWidth,
  shadowColor,
}: GridProductCardProps) {
  const rating = product.rating;

  return (
    <AnimatedPressable
      style={[
        styles.gridContainer,
        {
          width: gridWidth,
          backgroundColor: '#FFF',
          borderColor: '#F3F4F6',
          shadowColor,
        },
        animatedStyle,
      ]}
      onPress={handlePress}
      onPressIn={handleAnimateIn}
      onPressOut={handleAnimateOut}
      accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}
      accessibilityRole="button"
    >
      <View style={[styles.imageWrapper, { backgroundColor: '#F9FAFB' }]}>
        <Pressable
          onPress={handleWishlistPress}
          style={styles.wishlistBtn}
          pointerEvents="box-only"
          hitSlop={8}
          accessibilityLabel={
            isSaved
              ? `Remove ${product.name} from saved items`
              : `Save ${product.name} for later`
          }
          accessibilityRole="button"
        >
          <Animated.View style={[heartAnimatedStyle, styles.wishlistBlur]}>
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={18}
              color={isSaved ? '#EF4444' : '#9CA3AF'}
            />
          </Animated.View>
        </Pressable>

        {product.condition && (
          <View
            style={[
              styles.badgeContainer,
              product.condition === 'New'
                ? { backgroundColor: '#111827' }
                : { backgroundColor: '#4F46E5' },
            ]}
          >
            <Text style={styles.badgeText}>{product.condition}</Text>
          </View>
        )}

        {showLocalPlaceholder ? (
          <View style={[styles.gridImage, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={40} color="#9CA3AF" />
          </View>
        ) : (
          <Image {...imageProps} source={imageSource} style={styles.gridImage} />
        )}

        <Pressable
          onPress={handleAddToCart}
          style={styles.floatingCartBtn}
          pointerEvents="box-only"
          accessibilityLabel={`Add ${product.name} to cart`}
          accessibilityRole="button"
        >
          <Ionicons name="cart" size={18} color={BRAND.primary} />
          {cartItemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.badgeTextMini}>{cartItemCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.gridContent}>
        {rating != null ? (
          <View
            style={styles.ratingRowMini}
            accessible
            accessibilityLabel={`${rating} out of 5 stars`}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= Math.floor(rating) ? 'star' : 'star-outline'}
                size={10}
                color={BRAND.secondary}
              />
            ))}
            <Text style={styles.ratingTextMini}>({rating})</Text>
          </View>
        ) : (
          <View style={styles.ratingRowMini} accessible accessibilityLabel="No ratings">
            <Text style={styles.ratingTextMini}>No ratings</Text>
          </View>
        )}

        <Text style={[styles.gridName, { color: '#111827' }]} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={[styles.gridPrice, { color: BRAND.primary }]}>
            {formatPrice(product.price)}
          </Text>
          <Text style={styles.detailsText}>Details</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}
