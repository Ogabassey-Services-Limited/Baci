import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { PriceInput } from './PriceInput';
import { calculateProfitMargin } from './product-edit.helpers';

interface ProductPricingCardProps {
  colors: ThemeColors;
  costPrice: number;
  currencySymbol: string;
  onCostPriceChange: (value: number) => void;
  onPriceChange: (value: number) => void;
  price: number;
}

export function ProductPricingCard({
  colors,
  costPrice,
  currencySymbol,
  onCostPriceChange,
  onPriceChange,
  price,
}: ProductPricingCardProps) {
  const profit = calculateProfitMargin(colors, price, costPrice);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Pricing</Text>
      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Selling Price <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <PriceInput
            accessibilityLabel="Selling price"
            value={price}
            onChange={onPriceChange}
            placeholder="0.00"
            colors={colors}
            currencySymbol={currencySymbol}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Cost Price
          </Text>
          <PriceInput
            accessibilityLabel="Cost price"
            value={costPrice}
            onChange={onCostPriceChange}
            placeholder="0.00"
            colors={colors}
            currencySymbol={currencySymbol}
          />
        </View>
      </View>
      <View style={[styles.profitCard, { backgroundColor: colors.inputBg }]}>
        <Text style={[styles.profitLabel, { color: colors.textSecondary }]}>
          Profit Margin
        </Text>
        {profit.active ? (
          <Text style={[styles.profitValue, { color: profit.color }]}>
            {currencySymbol}
            {new Intl.NumberFormat().format(price - costPrice)} ({profit.percentage})
          </Text>
        ) : (
          <Text style={[styles.emptyProfitText, { color: colors.textSecondary }]}>
            Enter cost price to calculate margin
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  emptyProfitText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  profitCard: {
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 12,
    padding: 12,
  },
  profitLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  profitValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
});
