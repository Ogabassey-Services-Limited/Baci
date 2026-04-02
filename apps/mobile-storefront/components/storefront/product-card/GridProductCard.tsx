import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Colors, { BRAND } from '@/constants/Colors';
import { formatPrice, formatProductConditionDisplay } from '@/types/product';
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
  colors = Colors.light,
}: GridProductCardProps) {
  const rating = product.rating;
  const conditionLabel = formatProductConditionDisplay(product.condition);
  const conditionBadgeColors =
    conditionLabel === 'New'
      ? {
          backgroundColor: colors.success,
          color: colors.background,
        }
      : {
          backgroundColor: BRAND.primary,
          color: '#FFF',
        };

  return (
    <AnimatedPressable
      style={[
        styles.gridContainer,
        {
          width: gridWidth,
          backgroundColor: colors.card,
          borderColor: colors.border,
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
      <View style={[styles.imageWrapper, { backgroundColor: colors.muted }]}>
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
              size={16}
              color={isSaved ? colors.destructive : colors.mutedForeground}
            />
          </Animated.View>
        </Pressable>

        {conditionLabel && (
          <View
            style={[
              styles.badgeContainer,
              { backgroundColor: conditionBadgeColors.backgroundColor },
            ]}
          >
            <Text
              style={[styles.badgeText, { color: conditionBadgeColors.color }]}
            >
              {conditionLabel}
            </Text>
          </View>
        )}

        {showLocalPlaceholder ? (
          <View
            style={[styles.gridImage, styles.imagePlaceholder]}
            accessibilityLabel={`No image available for ${product.name}`}
            testID="grid-product-placeholder"
          >
            <Ionicons name="image-outline" size={40} color={colors.mutedForeground} />
          </View>
        ) : (
          <Image
            {...imageProps}
            source={imageSource}
            style={styles.gridImage}
            accessibilityLabel={`${product.name} image`}
            testID="grid-product-image"
          />
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

        <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={2}>
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
