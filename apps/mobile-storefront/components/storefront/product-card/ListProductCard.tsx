import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { BRAND } from '@/constants/Colors';
import { sanitizeDescriptionPlainText } from '@/components/storefront/utils/text';
import { formatPrice } from '@/types/product';
import styles from '../ProductCard.styles';
import type { ListProductCardProps } from './types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ListProductCard({
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
}: ListProductCardProps) {
  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handleAnimateIn}
      onPressOut={handleAnimateOut}
      style={[
        styles.listContainer,
        { backgroundColor: '#FFF', borderColor: '#F3F4F6' },
        animatedStyle,
      ]}
      accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}
      accessibilityRole="button"
    >
      {showLocalPlaceholder ? (
        <View style={[styles.listImage, styles.imagePlaceholder]}>
          <Ionicons name="image-outline" size={32} color="#9CA3AF" />
        </View>
      ) : (
        <Image {...imageProps} source={imageSource} style={styles.listImage} />
      )}
      <View style={styles.listContent}>
        <View style={styles.ratingRowMini}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={
                star <= Math.floor(product.rating || 0) ? 'star' : 'star-outline'
              }
              size={10}
              color="#F59E0B"
            />
          ))}
        </View>

        <Text style={[styles.listName, { color: '#111827' }]} numberOfLines={1}>
          {product.name}
        </Text>

        {product.description && (
          <Text style={styles.listDescription} numberOfLines={2}>
            {sanitizeDescriptionPlainText(product.description).substring(0, 100)}
          </Text>
        )}

        <View style={styles.listFooter}>
          <Text style={[styles.listPrice, { color: BRAND.primary }]}>
            {formatPrice(product.price)}
          </Text>
          <Pressable
            onPress={handleAddToCart}
            style={styles.listCartBtn}
            hitSlop={8}
            accessibilityLabel={`Add ${product.name} to cart`}
            accessibilityRole="button"
          >
            <View style={{ position: 'relative' }}>
              <Ionicons name="cart" size={16} color="#FFF" />
              {cartItemCount > 0 && (
                <View style={styles.listBadge}>
                  <Text style={styles.badgeTextMini}>{cartItemCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.listCartLabel}>Add</Text>
          </Pressable>
        </View>
      </View>

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
          color={isSaved ? '#EF4444' : '#9CA3AF'}
        />
      </Pressable>
    </AnimatedPressable>
  );
}
