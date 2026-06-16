import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPrice } from '@/components/product/product.shared';
import SafeImage from '@/components/ui/SafeImage';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { Product } from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import {
  getEffectiveProductStock,
  getProductStockBucket,
} from '@/lib/product-inventory';

export interface ProductItemProps {
  item: Product;
  currencySymbol: string;
  onPress: (id: string) => void;
}

export function ProductItem({
  item,
  currencySymbol,
  onPress,
}: ProductItemProps) {
  const { colors, shadows } = useTheme();
  const getStockStatus = () => {
    const stockBucket = getProductStockBucket(item);
    const stock = getEffectiveProductStock(item);

    if (stockBucket === 'unmanaged') {
      return { label: 'Unlimited stock', color: colors.success };
    }

    if (stockBucket === 'out_of_stock') {
      return { label: 'Out of stock', color: colors.error };
    }

    if (stockBucket === 'low_stock') {
      return { label: `Low stock: ${stock}`, color: colors.warning };
    }

    return { label: `In stock: ${stock}`, color: colors.success };
  };

  const stockStatus = getStockStatus();
  const imageUrl = item.images?.[0];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        { backgroundColor: colors.card, minHeight: 56 },
        shadows.sm,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`Product: ${item.name}, ${formatPrice(item.price, currencySymbol)}, ${stockStatus.label}`}
      accessibilityRole="button"
      accessibilityHint="View product details"
    >
      <View
        style={[
          styles.productImage,
          { backgroundColor: colors.backgroundLight },
        ]}
      >
        {imageUrl ? (
          <SafeImage source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <Ionicons name="image-outline" size={24} color={colors.textMuted} />
        )}
      </View>

      <View style={styles.productInfo}>
        <Text
          style={[styles.productName, { color: colors.text }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.text }]}>
            {formatPrice(item.price, currencySymbol)}
          </Text>
          {item.compare_at_price != null &&
          item.compare_at_price > item.price ? (
            <Text style={[styles.comparePrice, { color: colors.textMuted }]}>
              {formatPrice(item.compare_at_price, currencySymbol)}
            </Text>
          ) : null}
        </View>

        <View style={styles.stockRow}>
          <View
            style={[
              styles.stockIndicator,
              { backgroundColor: stockStatus.color },
            ]}
          />
          <Text
            style={[styles.stockText, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {stockStatus.label}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  productCard: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  productImage: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    height: 60,
    justifyContent: 'center',
    marginRight: SPACING.md,
    overflow: 'hidden',
    width: 60,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: 16,
    marginBottom: 4,
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 4,
  },
  price: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 15,
  },
  comparePrice: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 13,
    marginLeft: 6,
    textDecorationLine: 'line-through',
  },
  stockRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stockIndicator: {
    borderRadius: 4,
    height: 8,
    marginRight: 6,
    width: 8,
  },
  stockText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 13,
  },
});
