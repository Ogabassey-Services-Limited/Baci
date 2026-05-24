import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Pressable, Text, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { formatVatPercentage } from './new-order.shared';
import { styles } from './new-order.styles';

interface NewOrderSummarySectionProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderSummarySection({
  controller,
}: NewOrderSummarySectionProps) {
  const {
    colors,
    discount,
    formatPrice,
    isVatApplied,
    setFinancialValue,
    setShowFinancialModal,
    shippingFee,
    taxes,
    taxesToUse,
    total,
    subtotal,
    vatRate,
  } = controller;

  const formattedSubtotal = formatPrice(subtotal);
  const formattedDiscount =
    discount > 0 ? `- ${formatPrice(discount)}` : formatPrice(0);
  const formattedShippingFee = formatPrice(shippingFee);
  const formattedTaxes = formatPrice(taxesToUse);
  const formattedTotal = formatPrice(total);
  const taxLabel = isVatApplied
    ? `VAT (${formatVatPercentage(vatRate)}%)`
    : 'Taxes';
  // Stacked summary rows are flush (no margin between them); use asymmetric
  // hitSlop with vertical=0 so adjacent rows don't share touch zones, while
  // keeping a comfortable horizontal target for accessibility.
  const rowHitSlop = { top: 0, right: 16, bottom: 0, left: 16 };

  return (
    <View style={[styles.summaryContainer, { borderTopColor: colors.border }]}>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Subtotal
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {formattedSubtotal}
        </Text>
      </View>

      <Pressable
        accessibilityHint="Opens a modal to adjust the discount amount"
        accessibilityLabel={`Edit Discount, currently ${formattedDiscount}`}
        accessibilityRole="button"
        hitSlop={rowHitSlop}
        onPress={() => {
          setFinancialValue(discount > 0 ? discount.toString() : '');
          setShowFinancialModal({ type: 'discount', visible: true });
        }}
        style={({ pressed }) => [
          styles.summaryRow,
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Discount
          </Text>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={12} />
        </View>
        <Text
          style={[
            styles.summaryValue,
            { color: discount > 0 ? colors.error : colors.textMuted },
          ]}
        >
          {formattedDiscount}
        </Text>
      </Pressable>

      <Pressable
        accessibilityHint="Opens a modal to adjust the shipping fee"
        accessibilityLabel={`Edit Shipping Fee, currently ${formattedShippingFee}`}
        accessibilityRole="button"
        hitSlop={rowHitSlop}
        onPress={() => {
          setFinancialValue(shippingFee > 0 ? shippingFee.toString() : '');
          setShowFinancialModal({ type: 'shipping', visible: true });
        }}
        style={({ pressed }) => [
          styles.summaryRow,
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Shipping Fee
          </Text>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={12} />
        </View>
        <Text
          style={[
            styles.summaryValue,
            { color: shippingFee > 0 ? colors.text : colors.textMuted },
          ]}
        >
          {formattedShippingFee}
        </Text>
      </Pressable>

      <Pressable
        accessibilityHint="Opens a modal to adjust tax amounts"
        accessibilityLabel={`Edit ${taxLabel}, currently ${formattedTaxes}`}
        accessibilityRole="button"
        hitSlop={rowHitSlop}
        onPress={() => {
          setFinancialValue(taxes > 0 ? taxes.toString() : '');
          setShowFinancialModal({ type: 'tax', visible: true });
        }}
        style={({ pressed }) => [
          styles.summaryRow,
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            {taxLabel}
          </Text>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={12} />
        </View>
        <Text
          style={[
            styles.summaryValue,
            { color: taxesToUse > 0 ? colors.text : colors.textMuted },
          ]}
        >
          {formattedTaxes}
        </Text>
      </Pressable>

      <View
        style={[
          styles.summaryRow,
          {
            borderTopColor: colors.border,
            borderTopWidth: 1,
            marginTop: 4,
            paddingTop: 12,
          },
        ]}
      >
        <Text
          style={[
            styles.summaryLabel,
            { color: colors.text, fontSize: 16, fontWeight: '700' },
          ]}
        >
          Total Amount
        </Text>
        <Text
          style={[
            styles.summaryValue,
            { color: colors.text, fontSize: 18, fontWeight: '800' },
          ]}
        >
          {formattedTotal}
        </Text>
      </View>
    </View>
  );
}
