import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  getCustomerOrderStatusMeta,
  getCustomerOrderStatusPalette,
} from '@/lib/customer-order-status';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { getOrderDisplayTotal } from '@/lib/order-summary';

interface OrdersListItemColors {
  card: string;
  border: string;
  text: string;
  textSecondary: string;
}

interface OrdersListItemProduct {
  product_name: string;
  quantity: number;
}

export interface OrdersListItemOrder {
  id: string;
  shipping_status: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payment_status: string;
  created_at: string;
  items_count: number;
  items: OrdersListItemProduct[];
}

interface OrdersListItemProps {
  item: OrdersListItemOrder;
  colors: OrdersListItemColors;
  formatDate: (dateString: string) => string;
  onPress: (orderId: string) => void;
}

export function OrdersListItem({
  item,
  colors,
  formatDate,
  onPress,
}: OrdersListItemProps) {
  const statusMeta = getCustomerOrderStatusMeta(item.shipping_status);
  const statusPalette = getCustomerOrderStatusPalette(item.shipping_status);
  const primaryItem = item.items[0];
  const secondaryItems = Math.max(item.items.length - 1, 0);
  const displayTotal = getOrderDisplayTotal({
    subtotal: item.subtotal,
    shippingFee: item.shipping_fee,
    taxAmount: item.tax_amount,
    discountAmount: item.discount_amount,
    total: item.total,
    paymentStatus: item.payment_status,
  });

  return (
    <TouchableOpacity
      style={[
        styles.orderCard,
        {
          backgroundColor: colors.card,
          borderColor: statusPalette.border,
          shadowColor: statusPalette.accent,
        },
      ]}
      onPress={() => onPress(item.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`View details for order ${item.id}`}
    >
      <View
        style={[styles.orderAccent, { backgroundColor: statusPalette.accent }]}
      />

      <View style={styles.orderTopRow}>
        <View style={styles.orderStatusRow}>
          <View
            style={[
              styles.statusIconWrap,
              { backgroundColor: statusPalette.surface },
            ]}
          >
            <Ionicons
              name={statusMeta.icon}
              size={18}
              color={statusPalette.accent}
            />
          </View>
          <View style={styles.orderStatusCopy}>
            <Text style={[styles.statusHeadline, { color: statusPalette.accent }]}>
              {statusMeta.label}
            </Text>
            <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
              Placed {formatDate(item.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.orderTotalBlock}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
            Total
          </Text>
          <Text style={[styles.totalAmount, { color: colors.text }]}>
            {formatNgnCurrency(displayTotal)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.orderBody,
          {
            borderTopColor: colors.border,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text
          style={[styles.primaryItemName, { color: colors.text }]}
          numberOfLines={1}
        >
          {primaryItem?.product_name || 'Order items'}
        </Text>
        <Text
          style={[styles.orderNarrative, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {primaryItem
            ? secondaryItems > 0
              ? `+${secondaryItems} more item${secondaryItems === 1 ? '' : 's'}`
              : `${primaryItem.quantity} ${primaryItem.quantity === 1 ? 'item' : 'items'}`
            : `${item.items_count} ${item.items_count === 1 ? 'item' : 'items'}`}
        </Text>
      </View>

      <View style={styles.viewDetails}>
        <Text style={[styles.viewDetailsText, { color: statusPalette.accent }]}>
          View order details
        </Text>
        <Ionicons name="chevron-forward" size={16} color={statusPalette.accent} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  orderCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  orderAccent: {
    position: 'absolute',
    left: 0,
    top: 18,
    bottom: 18,
    width: 4,
    borderRadius: 999,
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  orderStatusRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderStatusCopy: {
    flex: 1,
  },
  statusHeadline: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderTotalBlock: {
    alignItems: 'flex-end',
  },
  orderDate: {
    fontSize: 13,
    marginTop: 4,
  },
  orderBody: {
    marginTop: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  primaryItemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderNarrative: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 14,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
