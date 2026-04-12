import { Ionicons } from '@expo/vector-icons';
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
  onOpenEditor: (item: TransactionReviewItem) => void;
  order: TransactionReviewOrder;
}

export function TransactionOrderCard({
  colors,
  formatCurrency,
  onOpenEditor,
  order,
}: TransactionOrderCardProps) {
  return (
    <View
      style={[
        styles.orderCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.orderHeader}>
        <View style={styles.flexOne}>
          <Text style={[styles.orderTitle, { color: colors.text }]}>
            {order.orderNumber}
          </Text>
          <Text style={[styles.orderSubtitle, { color: colors.textSecondary }]}>
            {order.customerName} · {order.paymentMethod}
          </Text>
        </View>
        <View style={styles.orderMeta}>
          <Text style={[styles.orderAmount, { color: colors.primary }]}>
            {formatCurrency(order.total)}
          </Text>
          <Text style={[styles.orderSubtitle, { color: colors.textMuted }]}>
            {new Date(order.createdAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>
      </View>

      {order.items.map((item) => (
        <Pressable
          key={item.id}
          disabled={!item.productId}
          style={[
            styles.itemRow,
            { borderTopColor: colors.border },
            !item.productId && styles.itemRowDisabled,
          ]}
          onPress={() => onOpenEditor(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.quantity} units, revenue ${formatCurrency(item.revenue)}`}
          accessibilityHint={
            item.productId
              ? 'Opens the cost price editor for this item'
              : 'This line item cannot be edited because it is not linked to a product'
          }
        >
          <View style={styles.flexOne}>
            <Text style={[styles.itemName, { color: colors.text }]}>
              {item.name}
            </Text>
            <Text
              style={[styles.orderSubtitle, { color: colors.textSecondary }]}
            >
              {item.quantity} units · Revenue {formatCurrency(item.revenue)}
            </Text>
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
                    item.costPrice == null ? colors.error : colors.textMuted,
                },
              ]}
            >
              {item.profit == null
                ? 'Profit unavailable'
                : `Profit ${formatCurrency(item.profit)}`}
            </Text>
          </View>
          {item.productId ? (
            <Ionicons
              name="create-outline"
              size={18}
              color={colors.textMuted}
            />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
