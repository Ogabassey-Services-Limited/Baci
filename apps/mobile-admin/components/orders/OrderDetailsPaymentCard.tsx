import { Ionicons } from '@expo/vector-icons';
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
  onRecordPayment: () => void;
  onRequestPayment: () => void;
  paymentColor: string;
  paymentLabel: string;
  paymentMethod?: string | null;
  paymentStatus: string;
  shippingFee?: number | null;
  subtotal?: number | null;
  total: number;
}

export function OrderDetailsPaymentCard({
  amountPaid,
  balance,
  colors,
  discountAmount,
  formatPrice,
  onRecordPayment,
  onRequestPayment,
  paymentColor,
  paymentLabel,
  paymentMethod,
  paymentStatus,
  shippingFee,
  subtotal,
  total,
}: OrderDetailsPaymentCardProps) {
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
              onPress={onRecordPayment}
              style={[
                styles.paymentActionButton,
                { borderColor: colors.success },
              ]}
            >
              <Ionicons color={colors.success} name="card-outline" size={18} />
              <Text
                style={[styles.paymentActionText, { color: colors.success }]}
              >
                Record Payment
              </Text>
            </Pressable>
            <Pressable
              onPress={onRequestPayment}
              style={[
                styles.paymentActionButton,
                { borderColor: colors.primary },
              ]}
            >
              <Ionicons
                color={colors.primary}
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
          {formatPrice(subtotal ?? total)}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Shipping
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {shippingFee ? formatPrice(shippingFee) : 'Free'}
        </Text>
      </View>
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
        <Text
          style={[
            styles.summaryValue,
            { color: colors.text, textTransform: 'capitalize' },
          ]}
        >
          {paymentMethod?.replace(/_/g, ' ') || 'N/A'}
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
