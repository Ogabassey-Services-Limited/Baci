import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import type { ReviewStats } from '@/hooks/use-reviews';
import type { Product } from '@/types/product';
import { formatPrice } from '@/types/product';
import { productDetailsBodyStyles as styles } from './ProductDetailsBody.styles';

type ColorsScheme = (typeof Colors)['light'];

interface ProductDetailsSummaryProps {
  colors: ColorsScheme;
  effectiveComparePrice: number | undefined;
  effectivePrice: number;
  product: Product;
  reviewStats: ReviewStats | null;
}

export function ProductDetailsSummary({
  colors,
  effectiveComparePrice,
  effectivePrice,
  product,
  reviewStats,
}: ProductDetailsSummaryProps) {
  const hasRating =
    typeof reviewStats?.average_rating === 'number' &&
    Number.isFinite(reviewStats.average_rating)
      ? true
      : typeof product.rating === 'number' && Number.isFinite(product.rating);
  const rating = hasRating
    ? (reviewStats?.average_rating ?? product.rating ?? 0)
    : 0;
  const ratingLabel =
    typeof reviewStats?.average_rating === 'number' &&
    Number.isFinite(reviewStats.average_rating)
      ? `${reviewStats.average_rating.toFixed(1)} (${reviewStats.review_count ?? 0} reviews)`
      : product.rating
        ? `${product.rating} (${product.review_count || 0} reviews)`
        : 'No reviews yet';

  return (
    <>
      <View style={styles.metaRow}>
        {product.brand && (
          <Text style={[styles.brandText, { color: colors.textSecondary }]}>
            {product.brand}
          </Text>
        )}
        {product.condition && (
          <View
            style={[
              styles.conditionBadge,
              {
                backgroundColor:
                  product.condition === 'New' ? colors.success : colors.warning,
              },
            ]}
          >
            <Text
              style={[
                styles.conditionText,
                { color: colors.primaryForeground },
              ]}
            >
              {product.condition}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{product.name}</Text>

      <View style={styles.ratingRow}>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={s <= Math.round(rating) ? 'star' : 'star-outline'}
              size={14}
              color={s <= Math.round(rating) ? colors.rating : colors.border}
            />
          ))}
        </View>
        <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
          {ratingLabel}
        </Text>
      </View>

      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: BRAND.primary }]}>
          {formatPrice(effectivePrice)}
        </Text>
        {effectiveComparePrice && effectiveComparePrice > effectivePrice && (
          <Text style={[styles.comparePrice, { color: colors.textSecondary }]}>
            {formatPrice(effectiveComparePrice)}
          </Text>
        )}
      </View>
    </>
  );
}
