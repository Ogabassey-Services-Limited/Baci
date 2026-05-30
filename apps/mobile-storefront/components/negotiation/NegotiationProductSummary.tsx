import { Text, View } from 'react-native';
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
  return (
    <View style={styles.productInfo}>
      <Text style={styles.productLabel}>PRODUCT</Text>
      <Text style={styles.productName} numberOfLines={1}>
        {productName}
      </Text>
      <Text style={styles.priceRow}>
        <Text style={styles.priceLabel}>Current Price: </Text>
        <Text style={styles.priceValue}>{formatPrice(currentPrice)}</Text>
      </Text>
    </View>
  );
}
