import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
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

  return (
    <View style={[styles.summaryContainer, { borderTopColor: colors.border }]}>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Subtotal
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {formatPrice(subtotal)}
        </Text>
      </View>

      <Pressable
        onPress={() => {
          setFinancialValue(discount > 0 ? discount.toString() : '');
          setShowFinancialModal({ type: 'discount', visible: true });
        }}
        style={styles.summaryRow}
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
          {discount > 0 ? `- ${formatPrice(discount)}` : formatPrice(0)}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          setFinancialValue(shippingFee > 0 ? shippingFee.toString() : '');
          setShowFinancialModal({ type: 'shipping', visible: true });
        }}
        style={styles.summaryRow}
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
          {formatPrice(shippingFee)}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          setFinancialValue(taxes > 0 ? taxes.toString() : '');
          setShowFinancialModal({ type: 'tax', visible: true });
        }}
        style={styles.summaryRow}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            {isVatApplied ? `VAT (${(vatRate * 100).toFixed(1)}%)` : 'Taxes'}
          </Text>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={12} />
        </View>
        <Text
          style={[
            styles.summaryValue,
            { color: taxesToUse > 0 ? colors.text : colors.textMuted },
          ]}
        >
          {formatPrice(taxesToUse)}
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
          {formatPrice(total)}
        </Text>
      </View>
    </View>
  );
}
