import Ionicons from "@react-native-vector-icons/ionicons/static";
import type React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BRAND } from '@/constants/Colors';
import type { ReceiptListItem } from '@/types/receipt';

const PAYMENT_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  paid: { label: 'Receipt', color: '#059669', icon: 'checkmark-circle' },
  partially_paid: {
    label: 'Partial',
    color: '#D97706',
    icon: 'ellipsis-horizontal-circle',
  },
  unpaid: { label: 'Invoice', color: '#DC2626', icon: 'document-text' },
  refunded: { label: 'Refunded', color: '#6B7280', icon: 'refresh-circle' },
};

export function getPaymentConfig(status: string) {
  return PAYMENT_STATUS_CONFIG[status] ?? PAYMENT_STATUS_CONFIG.unpaid;
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatPrice(price: number, currency: string = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(price);
}

interface ReceiptCardProps {
  item: ReceiptListItem;
  colors: { card: string; text: string; textSecondary: string };
  onPress: (item: ReceiptListItem) => void;
  onPrefetch?: (orderId: string) => void;
}

export function ReceiptCard({
  item,
  colors,
  onPress,
  onPrefetch,
}: ReceiptCardProps) {
  const config = getPaymentConfig(item.payment_status);
  const firstItem = item.items[0];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => onPress(item)}
      onPressIn={() => onPrefetch?.(item.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${config.label} for order ${item.order_number}`}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.orderNumber, { color: colors.text }]}>
            #{item.order_number}
          </Text>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${config.color}15` }]}>
          <Ionicons
            name={config.icon as React.ComponentProps<typeof Ionicons>['name']}
            size={14}
            color={config.color}
          />
          <Text style={[styles.badgeText, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
      </View>

      {firstItem && (
        <Text
          style={[styles.itemName, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {firstItem.product_name}
          {item.items.length > 1 && ` +${item.items.length - 1} more`}
        </Text>
      )}

      <View style={styles.cardFooter}>
        <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
          {item.payment_status === 'paid' ? 'Paid' : 'Total'}
        </Text>
        <Text style={[styles.totalAmount, { color: colors.text }]}>
          {formatPrice(item.total, item.currency)}
        </Text>
      </View>

      {item.payment_status === 'partially_paid' && (
        <View style={styles.balanceRow}>
          <Text style={[styles.balanceLabel, { color: '#D97706' }]}>
            Balance: {formatPrice(item.total - item.amount_paid, item.currency)}
          </Text>
        </View>
      )}

      <View style={styles.viewAction}>
        <Text style={[styles.viewActionText, { color: BRAND.primary }]}>
          View {config.label}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={BRAND.primary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  date: {
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemName: {
    fontSize: 14,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  totalLabel: {
    fontSize: 14,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  balanceRow: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
  },
  viewActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
