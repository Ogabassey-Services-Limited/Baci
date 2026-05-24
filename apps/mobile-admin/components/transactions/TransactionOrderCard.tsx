import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { styles } from '@/components/transactions/transactions.styles';
import type { ThemeColors } from '@/constants/theme';
import type {
  TransactionReviewItem,
  TransactionReviewOrder,
} from '@/hooks/useTransactionReview';

interface TransactionOrderCardProps {
  colors: ThemeColors;
  formatCurrency: (amount: number) => string;
  onOpenEditor: (
    order: TransactionReviewOrder,
    item: TransactionReviewItem
  ) => void;
  order: TransactionReviewOrder;
}

export function TransactionOrderCard({
  colors,
  formatCurrency,
  onOpenEditor,
  order,
}: TransactionOrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const firstItem = order.items[0];
  const itemCount = order.items.length;
  const dateLabel = new Date(order.createdAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
  const costStatusLabel =
    order.missingCostCount > 0
      ? `${order.missingCostCount} missing cost${
          order.missingCostCount === 1 ? '' : 's'
        }`
      : 'Costs complete';
  const detailsActionLabel = expanded
    ? `Close order details for ${order.customerName}`
    : `View order details for ${order.customerName}`;

  return (
    <View
      style={[
        styles.orderCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Pressable
        accessibilityLabel={detailsActionLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((previous) => !previous)}
        style={({ pressed }) => [
          styles.orderSummaryButton,
          pressed && { opacity: 0.82 },
        ]}
      >
        <View style={styles.orderHeaderButton}>
          <View style={styles.flexOne}>
            <Text style={[styles.orderCustomerName, { color: colors.text }]}>
              {order.customerName}
            </Text>
            <Text style={[styles.orderNumberText, { color: colors.textMuted }]}>
              {order.orderNumber}
            </Text>
          </View>
          <View style={styles.orderMeta}>
            <Text style={[styles.orderAmount, { color: colors.primary }]}>
              {formatCurrency(order.total)}
            </Text>
            <Text style={[styles.orderSubtitle, { color: colors.textMuted }]}>
              {dateLabel}
            </Text>
          </View>
          <View
            style={[
              styles.orderCloseButton,
              {
                backgroundColor: expanded ? colors.inputBg : 'transparent',
              },
            ]}
          >
            <Ionicons
              name={expanded ? 'close' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.orderPreview}>
          <Text
            numberOfLines={1}
            style={[styles.orderPreviewTitle, { color: colors.textSecondary }]}
          >
            {firstItem?.name ?? 'No line items recorded'}
          </Text>
          <View style={styles.orderBadgeRow}>
            <Text
              style={[
                styles.orderBadge,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.textSecondary,
                },
              ]}
            >
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </Text>
            <Text
              style={[
                styles.orderBadge,
                {
                  backgroundColor:
                    order.missingCostCount > 0
                      ? colors.errorLight
                      : colors.successLight,
                  color:
                    order.missingCostCount > 0 ? colors.error : colors.success,
                },
              ]}
            >
              {costStatusLabel}
            </Text>
            <Text
              style={[
                styles.orderBadge,
                {
                  backgroundColor: colors.primaryLight,
                  color: colors.primary,
                },
              ]}
            >
              {order.paymentMethod}
            </Text>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.orderDetails}>
          <View style={styles.orderDetailGrid}>
            {order.customerPhone ? (
              <Text
                style={[
                  styles.orderDetailText,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.textSecondary,
                  },
                ]}
              >
                {order.customerPhone}
              </Text>
            ) : null}
            {order.customerEmail ? (
              <Text
                style={[
                  styles.orderDetailText,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.textSecondary,
                  },
                ]}
              >
                {order.customerEmail}
              </Text>
            ) : null}
          </View>

          {order.items.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.itemRow, { borderTopColor: colors.border }]}
              onPress={() => onOpenEditor(order, item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.quantity} units, revenue ${formatCurrency(item.revenue)}${
                item.supplierName ? `, supplier ${item.supplierName}` : ''
              }`}
              accessibilityHint="Opens the transaction editor for this item"
            >
              <View style={styles.flexOne}>
                <Text style={[styles.itemName, { color: colors.text }]}>
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.orderSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {item.quantity} units · Revenue {formatCurrency(item.revenue)}
                </Text>
                {item.supplierName ? (
                  <Text
                    style={[styles.itemDetailText, { color: colors.textMuted }]}
                  >
                    Supplier {item.supplierName}
                  </Text>
                ) : null}
                {!item.productId ? (
                  <Text
                    style={[styles.itemDetailText, { color: colors.textMuted }]}
                  >
                    Custom item
                  </Text>
                ) : null}
                {item.imeiValues[0] ? (
                  <Text
                    style={[styles.itemDetailText, { color: colors.textMuted }]}
                  >
                    IMEI {item.imeiValues[0]}
                  </Text>
                ) : null}
                {item.serialValues[0] ? (
                  <Text
                    style={[styles.itemDetailText, { color: colors.textMuted }]}
                  >
                    S/N {item.serialValues[0]}
                  </Text>
                ) : null}
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMetaValue, { color: colors.text }]}>
                  {item.costPrice == null
                    ? 'Cost missing'
                    : `Cost ${formatCurrency(item.costPrice)}`}
                </Text>
                <Text
                  style={[
                    styles.orderSubtitle,
                    {
                      color:
                        item.costPrice == null
                          ? colors.error
                          : colors.textMuted,
                    },
                  ]}
                >
                  {item.profit == null
                    ? 'Profit unavailable'
                    : `Profit ${formatCurrency(item.profit)}`}
                </Text>
              </View>
              <Ionicons
                name="create-outline"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
