import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { BLURHASH_VARIANTS } from '@/components/storefront/ProductCard';
import type Colors from '@/constants/Colors';
import {
  BRAND,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/Colors';
import type { SavedItem } from '@/stores/saved-store';
import { formatPrice, getDiscountPercentage } from '@/types/product';
import { SAVED_ITEM_CARD_STYLE_TOKENS } from './saved-item-card.constants';

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
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
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
          <Ionicons
            name="cart-outline"
            size={18}
            color={colors.white}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
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
    paddingHorizontal:
      SAVED_ITEM_CARD_STYLE_TOKENS.discountBadgePaddingHorizontal,
    paddingVertical: SAVED_ITEM_CARD_STYLE_TOKENS.discountBadgePaddingVertical,
    borderRadius: RADIUS.sm,
  },
  discountText: {
    fontSize: SAVED_ITEM_CARD_STYLE_TOKENS.discountTextSize,
    fontWeight: '700',
  },
  infoContainer: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  brandText: {
    fontSize: SAVED_ITEM_CARD_STYLE_TOKENS.brandTextSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: SAVED_ITEM_CARD_STYLE_TOKENS.brandLetterSpacing,
    marginBottom: SAVED_ITEM_CARD_STYLE_TOKENS.microSpacing,
  },
  nameText: {
    fontSize: SAVED_ITEM_CARD_STYLE_TOKENS.nameTextSize,
    fontWeight: '600',
    lineHeight: TYPOGRAPHY.size.lg,
    marginBottom: SPACING.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  priceText: {
    fontSize: SAVED_ITEM_CARD_STYLE_TOKENS.priceTextSize,
    fontWeight: '700',
  },
  comparePriceText: {
    fontSize: SAVED_ITEM_CARD_STYLE_TOKENS.secondaryTextSize,
    textDecorationLine: 'line-through',
  },
  savedDateText: {
    fontSize: SAVED_ITEM_CARD_STYLE_TOKENS.metaTextSize,
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
    fontSize: SAVED_ITEM_CARD_STYLE_TOKENS.secondaryTextSize,
    fontWeight: '600',
  },
  primaryActionText: {
    fontSize: SAVED_ITEM_CARD_STYLE_TOKENS.secondaryTextSize,
    fontWeight: '600',
  },
});
