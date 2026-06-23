import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { formatPrice } from '@/stores/cart-store';
import { negotiationModalViewStyles as styles } from './NegotiationModalView.styles';

type NegotiationProductSummaryProps = {
  currentPrice: number;
  productName: string;
};

export function NegotiationProductSummary({
  currentPrice,
  productName,
}: NegotiationProductSummaryProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.productInfo,
        { backgroundColor: colors.muted, borderColor: colors.border },
      ]}
    >
      <View style={styles.productInfoText}>
        <Text style={[styles.productLabel, { color: colors.textSecondary }]}>
          PRODUCT
        </Text>
        <Text
          style={[styles.productName, { color: colors.text }]}
          numberOfLines={2}
        >
          {productName}
        </Text>
      </View>
      <View style={styles.productPriceColumn}>
        <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
          Current price
        </Text>
        <Text style={[styles.priceValue, { color: colors.text }]}>
          {formatPrice(currentPrice)}
        </Text>
      </View>
    </View>
  );
}
