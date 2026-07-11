import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { getTranslucentColor } from '@/lib/colors/sanitize-css-color';
import { orderDetailsItemsStyles as styles } from './order-details-items.styles';

interface OrderDetailsPaymentCardProps {
  amountPaid: number;
  balance: number;
  colors: ThemeColors;
  discountAmount: number;
  formatPrice: (amount: number) => string;
  giftWrappingFee?: number | null;
  onRecordPayment: () => void;
  onRequestPayment: () => void;
  paymentColor: string;
  paymentLabel: string;
  paymentMethod?: string | null;
  paymentStatus: string;
  shippingFee?: number | null;
  showVat?: boolean;
  subtotal?: number | null;
  taxAmount?: number | null;
  total: number;
  vatLabel?: string;
  walletAmountUsed?: number | null;
}

function formatPaymentMethodLabel(paymentMethod: string | null | undefined) {
  const normalized = paymentMethod?.trim();
  if (!normalized) {
    return 'N/A';
  }

  const key = normalized.toLowerCase();
  if (
    key === 'transfer' ||
    key === 'bank_transfer' ||
    key === 'bank-transfer'
  ) {
    return 'Bank Transfer';
  }

  if (key === 'pos') {
    return 'POS';
  }

  return normalized
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function OrderDetailsPaymentCard({
  amountPaid,
  balance,
  colors,
  discountAmount,
  formatPrice,
  giftWrappingFee = 0,
  onRecordPayment,
  onRequestPayment,
  paymentColor,
  paymentLabel,
  paymentMethod,
  paymentStatus,
  shippingFee,
  showVat = false,
  subtotal,
  taxAmount = 0,
  total,
  vatLabel = 'VAT',
  walletAmountUsed = 0,
}: OrderDetailsPaymentCardProps) {
  const giftWrappingFeeAmount = giftWrappingFee ?? 0;
  const taxAmountValue = taxAmount ?? 0;
  const walletAmountValue = walletAmountUsed ?? 0;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.cardTitle, { color: colors.text }]}>
        Payment Summary
      </Text>
      {paymentStatus !== 'paid' ? (
        <>
          <View style={styles.paymentActionsRow}>
            <Pressable
              accessibilityLabel="Record payment"
              accessibilityRole="button"
              onPress={onRecordPayment}
              style={[
                styles.paymentActionButton,
                { borderColor: colors.success },
              ]}
            >
              <Ionicons
                accessibilityElementsHidden
                accessible={false}
                color={colors.success}
                importantForAccessibility="no"
                name="card-outline"
                size={18}
              />
              <Text
                style={[styles.paymentActionText, { color: colors.success }]}
              >
                Record Payment
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Request payment"
              accessibilityRole="button"
              onPress={onRequestPayment}
              style={[
                styles.paymentActionButton,
                { borderColor: colors.primary },
              ]}
            >
              <Ionicons
                accessibilityElementsHidden
                accessible={false}
                color={colors.primary}
                importantForAccessibility="no"
                name="notifications-outline"
                size={18}
              />
              <Text
                style={[styles.paymentActionText, { color: colors.primary }]}
              >
                Request Payment
              </Text>
            </Pressable>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </>
      ) : null}
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Subtotal
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {formatPrice(subtotal && subtotal > 0 ? subtotal : total)}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Shipping
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {shippingFee == null || shippingFee === 0
            ? 'Free'
            : formatPrice(shippingFee)}
        </Text>
      </View>
      {giftWrappingFeeAmount > 0 ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Gift Wrapping
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {formatPrice(giftWrappingFeeAmount)}
          </Text>
        </View>
      ) : null}
      {discountAmount > 0 ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Discount
          </Text>
          <Text style={[styles.summaryValue, { color: colors.error }]}>
            -{formatPrice(discountAmount)}
          </Text>
        </View>
      ) : null}
      {showVat ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            {vatLabel}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {formatPrice(taxAmountValue)}
          </Text>
        </View>
      ) : null}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.summaryRow}>
        <Text style={[styles.totalLabel, { color: colors.text }]}>
          Total Order
        </Text>
        <Text style={[styles.totalValue, { color: colors.text }]}>
          {formatPrice(total)}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Payment Method
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {formatPaymentMethodLabel(paymentMethod)}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Payment Status
        </Text>
        <View
          style={[
            styles.statusBadgeSmall,
            {
              backgroundColor: getTranslucentColor(
                paymentColor,
                colors.backgroundLight,
                0.08
              ),
            },
          ]}
        >
          <Text style={[styles.statusTextSmall, { color: paymentColor }]}>
            {paymentLabel}
          </Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Amount Paid
        </Text>
        <Text
          style={[
            styles.summaryValue,
            {
              color: amountPaid > 0 ? colors.success : colors.textSecondary,
              fontWeight: '700',
            },
          ]}
        >
          {formatPrice(amountPaid)}
        </Text>
      </View>
      {walletAmountValue > 0 ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Includes wallet credit
          </Text>
          <Text style={[styles.summaryValue, { color: colors.textSecondary }]}>
            {formatPrice(walletAmountValue)}
          </Text>
        </View>
      ) : null}
      {balance > 0 ? (
        <View style={styles.summaryRow}>
          <Text
            style={[styles.totalLabel, { color: colors.text, fontSize: 14 }]}
          >
            Balance Due
          </Text>
          <Text
            style={[styles.totalValue, { color: colors.error, fontSize: 18 }]}
          >
            {formatPrice(balance)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
