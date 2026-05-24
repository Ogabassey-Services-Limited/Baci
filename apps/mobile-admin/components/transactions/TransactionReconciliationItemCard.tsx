import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { RankedReconciliationCandidate } from '@/lib/transaction-reconciliation';

export interface TransactionReconciliationItemCardProps {
  colors: ThemeColors;
  createdAt?: string;
  customerName?: string | null;
  formatCurrency: (amount: number) => string;
  isMutating: boolean;
  item: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  };
  matches: RankedReconciliationCandidate[];
  onKeepCustom: (itemId: string) => void;
  onLink: (input: {
    itemId: string;
    productId: string;
    variantId: string | null;
  }) => void;
  orderNumber?: string | null;
}

function formatShortDate(value: string | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

export function TransactionReconciliationItemCard({
  colors,
  createdAt,
  customerName,
  formatCurrency,
  isMutating,
  item,
  matches,
  onKeepCustom,
  onLink,
  orderNumber,
}: TransactionReconciliationItemCardProps) {
  return (
    <View
      style={[
        styles.itemCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.flexOne}>
          <Text style={[styles.customerName, { color: colors.text }]}>
            {customerName || 'Walk-in customer'}
          </Text>
          <Text style={[styles.orderNumber, { color: colors.textSecondary }]}>
            {orderNumber ?? 'Order'}
          </Text>
        </View>
        <View style={styles.amountColumn}>
          <Text style={[styles.amount, { color: colors.primary }]}>
            {formatCurrency(item.price)}
          </Text>
          <Text style={[styles.orderDate, { color: colors.textMuted }]}>
            {formatShortDate(createdAt)}
          </Text>
        </View>
      </View>

	      <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
	      <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
	        {item.quantity} item{item.quantity === 1 ? '' : 's'}
	      </Text>

      {matches.length > 0 ? (
        <View style={styles.matches}>
          {matches.map((match) => (
            <Pressable
              key={`${match.productId}:${match.variantId ?? 'product'}`}
              accessibilityLabel={`Link ${match.label}`}
              accessibilityRole="button"
              disabled={isMutating}
              onPress={() => {
                onLink({
                  itemId: item.id,
                  productId: match.productId,
                  variantId: match.variantId,
                });
              }}
              style={({ pressed }) => [
                styles.matchButton,
                {
                  backgroundColor: `${colors.primary}12`,
                  borderColor: `${colors.primary}35`,
                  opacity: isMutating ? 0.6 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.matchTitle, { color: colors.primary }]}>
                {match.label}
              </Text>
              <Text style={[styles.matchMeta, { color: colors.textSecondary }]}>
                {formatCurrency(match.price)} · {match.confidence}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={[styles.noMatchText, { color: colors.textSecondary }]}>
          No close catalog match found.
        </Text>
      )}

      <Pressable
        accessibilityLabel="Keep item custom"
        accessibilityRole="button"
        disabled={isMutating}
        onPress={() => onKeepCustom(item.id)}
        style={({ pressed }) => [
          styles.secondaryButton,
          {
            borderColor: colors.border,
            opacity: isMutating ? 0.6 : pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text
          style={[styles.secondaryButtonText, { color: colors.textSecondary }]}
        >
          Keep custom
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  amountColumn: {
    alignItems: 'flex-end',
  },
  cardHeader: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  customerName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
  },
  flexOne: {
    flex: 1,
  },
  itemCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  itemMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
  itemName: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  matchButton: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  matchMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.xs,
    textTransform: 'capitalize',
  },
  matches: {
    gap: SPACING.sm,
  },
  matchTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  noMatchText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
  orderDate: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.xs,
  },
  orderNumber: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: SPACING.xs,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  secondaryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
