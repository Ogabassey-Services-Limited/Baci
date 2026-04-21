import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { BLURHASH_VARIANTS } from '@/components/storefront/ProductCard';
import type Colors from '@/constants/Colors';
import { BRAND, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import type { SavedItem } from '@/stores/saved-store';
import { formatPrice, getDiscountPercentage } from '@/types/product';

interface SavedItemCardProps {
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  item: SavedItem;
  onAddToCart: (item: SavedItem) => void;
  onPress: (item: SavedItem) => void;
  onRemove: (item: SavedItem) => void;
}

function formatSavedDate(timestamp: number) {
  const date = new Date(timestamp);

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

export function SavedItemCard({
  colors,
  item,
  onAddToCart,
  onPress,
  onRemove,
}: SavedItemCardProps) {
  const discountPercentage = getDiscountPercentage(
    item.price,
    item.compare_at_price
  );

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify()}
      style={[styles.itemCard, { backgroundColor: colors.card }]}
    >
      <Pressable
        onPress={() => onPress(item)}
        style={styles.itemContent}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.name}`}
      >
        <View
          style={[styles.imageContainer, { backgroundColor: colors.border }]}
        >
          <Image
            source={{ uri: item.image }}
            style={styles.image}
            contentFit="cover"
            placeholder={{ blurhash: BLURHASH_VARIANTS.default }}
            transition={200}
            cachePolicy="memory-disk"
          />
          {discountPercentage && (
            <View style={styles.discountBadge}>
              <Text style={[styles.discountText, { color: colors.white }]}>
                -{discountPercentage}%
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          {item.brand ? (
            <Text style={[styles.brandText, { color: colors.textSecondary }]}>
              {item.brand}
            </Text>
          ) : null}
          <Text
            style={[styles.nameText, { color: colors.text }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>

          <View style={styles.priceRow}>
            <Text style={[styles.priceText, { color: BRAND.primary }]}>
              {formatPrice(item.price)}
            </Text>
            {item.compare_at_price ? (
              <Text
                style={[
                  styles.comparePriceText,
                  { color: colors.textSecondary },
                ]}
              >
                {formatPrice(item.compare_at_price)}
              </Text>
            ) : null}
          </View>

          <Text style={[styles.savedDateText, { color: colors.textSecondary }]}>
            Saved {formatSavedDate(item.savedAt)}
          </Text>
        </View>
      </Pressable>

      <View style={styles.actionsRow}>
        <Pressable
          style={[
            styles.actionButton,
            styles.removeButton,
            { borderColor: colors.border },
          ]}
          onPress={() => onRemove(item)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name} from saved items`}
        >
          <Ionicons
            name="heart-dislike-outline"
            size={18}
            color={colors.textSecondary}
          />
          <Text
            style={[styles.actionButtonText, { color: colors.textSecondary }]}
          >
            Remove
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionButton,
            styles.cartButton,
            { backgroundColor: BRAND.primary },
          ]}
          onPress={() => onAddToCart(item)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.name} to cart`}
        >
          <Ionicons name="cart-outline" size={18} color={colors.white} />
          <Text style={[styles.primaryActionText, { color: colors.white }]}>
            Add to Cart
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  itemCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  itemContent: {
    flexDirection: 'row',
    padding: SPACING.md,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  infoContainer: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
  },
  comparePriceText: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  savedDateText: {
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  removeButton: {
    borderWidth: 1,
  },
  cartButton: {},
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
