import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatLargePrice,
  formatMetric,
  formatPrice,
} from '@/components/product/product.shared';
import SafeImage from '@/components/ui/SafeImage';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { TopSellingProduct } from '@/hooks/useTopSellingProducts';

export interface TopSellingProductItemProps {
  item: TopSellingProduct;
  currencySymbol: string;
  onPress: (id: string) => void;
}

export function TopSellingProductItem({
  item,
  currencySymbol,
  onPress,
}: TopSellingProductItemProps) {
  const { colors, shadows } = useTheme();
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
      accessibilityLabel={`Top seller: ${item.name}, ${formatPrice(item.price, currencySymbol)}, ${formatMetric(item.totalSold)} sold`}
      accessibilityRole="button"
      accessibilityHint="View product details"
    >
      <View style={[styles.productRank, { backgroundColor: colors.gold }]}>
        <Ionicons name="trophy" size={12} color="#FFF" />
      </View>

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
        </View>

        <View style={styles.stockRow}>
          <Ionicons
            name="analytics"
            size={14}
            color={colors.primary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.stockText, { color: colors.primary }]}>
            {formatMetric(item.totalSold)} sold •{' '}
            {formatLargePrice(item.totalRevenue, currencySymbol)} rev
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
  productRank: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 24,
    justifyContent: 'center',
    left: 4,
    position: 'absolute',
    top: -8,
    width: 24,
    zIndex: 1,
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
  stockRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stockText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 13,
  },
});
