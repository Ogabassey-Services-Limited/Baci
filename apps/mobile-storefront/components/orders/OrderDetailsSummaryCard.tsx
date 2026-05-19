import { StyleSheet, Text, View } from 'react-native';

export interface OrderDetailsSummaryBreakdown {
  itemsSubtotal: number;
  assuranceFee: number;
  shippingFee: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
}

interface OrderDetailsSummaryCardColors {
  border: string;
  card: string;
  text: string;
  textSecondary: string;
}

interface OrderDetailsSummaryCardProps {
  colors: OrderDetailsSummaryCardColors;
  formatCurrency: (amount: number) => string;
  paymentMethod: string | null | undefined;
  paymentStatus: string | null | undefined;
  summaryBreakdown: OrderDetailsSummaryBreakdown;
}

function toReadableLabel(value: string | null | undefined): string {
  return value?.replace(/_/g, ' ') ?? '';
}

export function getOrderDetailsPaymentLabel(
  paymentMethod: string | null | undefined,
  paymentStatus: string | null | undefined
): string {
  const readablePaymentMethod = toReadableLabel(paymentMethod);
  const readablePaymentStatus = toReadableLabel(paymentStatus);

  if (paymentStatus === 'paid') {
    return `Paid via ${readablePaymentMethod}`;
  }

  if (paymentStatus === 'partially_paid') {
    return `Partially paid via ${readablePaymentMethod}`;
  }

  if (paymentStatus === 'pending') {
    return 'Payment pending';
  }

  return `${readablePaymentMethod} - ${readablePaymentStatus}`.trim();
}

export function OrderDetailsSummaryCard({
  colors,
  formatCurrency,
  paymentMethod,
  paymentStatus,
  summaryBreakdown,
}: OrderDetailsSummaryCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Order Summary
      </Text>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Subtotal
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {formatCurrency(summaryBreakdown.itemsSubtotal)}
        </Text>
      </View>

      {summaryBreakdown.assuranceFee > 0 && (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Device Assurance
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {formatCurrency(summaryBreakdown.assuranceFee)}
          </Text>
        </View>
      )}

      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Shipping
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {summaryBreakdown.shippingFee === 0
            ? 'Free'
            : formatCurrency(summaryBreakdown.shippingFee)}
        </Text>
      </View>

      {summaryBreakdown.taxAmount > 0 && (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            VAT
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {formatCurrency(summaryBreakdown.taxAmount)}
          </Text>
        </View>
      )}

      {summaryBreakdown.discountAmount > 0 && (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Discount
          </Text>
          <Text style={[styles.summaryValue, { color: '#059669' }]}>
            -{formatCurrency(summaryBreakdown.discountAmount)}
          </Text>
        </View>
      )}

      <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
        <Text style={[styles.totalValue, { color: colors.text }]}>
          {formatCurrency(summaryBreakdown.total)}
        </Text>
      </View>

      <View style={[styles.paymentInfo, { borderTopColor: colors.border }]}>
        <Text style={[styles.paymentMethod, { color: colors.textSecondary }]}>
          {getOrderDetailsPaymentLabel(paymentMethod, paymentStatus)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  paymentInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  paymentMethod: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
});
