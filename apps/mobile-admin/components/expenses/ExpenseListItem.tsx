import Ionicons from "@react-native-vector-icons/ionicons/static";
import { format, isValid, parseISO } from 'date-fns';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { getTranslucentColor } from '@/lib/colors/sanitize-css-color';
import { formatCurrency } from '@/lib/utils';
import type { Expense } from '@/schemas/expense';
import { styles } from './expenses-list.styles';

export interface ExpenseListItemProps {
  item: Expense;
  merchant?: { payout_currency?: string | null } | null;
}

export function ExpenseListItem({ item, merchant }: ExpenseListItemProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const expenseLabel = item.description
    ? `Open expense ${item.category}: ${item.description}`
    : `Open expense ${item.category}`;
  const primaryBackground = getTranslucentColor(
    colors.primary,
    'rgba(59, 130, 246, 0.15)',
    0.15
  );
  const parsedDate = parseISO(item.date);
  const formattedDate = isValid(parsedDate)
    ? format(parsedDate, 'MMM d, yyyy')
    : 'Invalid date';

  return (
    <Pressable
      style={[
        styles.expenseItem,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() => router.push(`/expenses/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={expenseLabel}
    >
      <View
        style={[styles.categoryIcon, { backgroundColor: primaryBackground }]}
      >
        <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
      </View>

      <View style={styles.expenseDetails}>
        <Text style={[styles.expenseCategory, { color: colors.text }]}>
          {item.category}
        </Text>
        {item.description ? (
          <Text
            style={[styles.expenseDescription, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.description}
          </Text>
        ) : null}
        <Text style={[styles.expenseDate, { color: colors.textMuted }]}>
          {formattedDate}
        </Text>
      </View>

      <View style={styles.expenseAmount}>
        <Text style={[styles.amountText, { color: colors.text }]}>
          {formatCurrency(
            item.amount,
            undefined,
            merchant?.payout_currency ?? 'NGN'
          )}
        </Text>
        {item.receipt_url ? (
          <Ionicons
            name="document-attach-outline"
            size={14}
            color={colors.textSecondary}
            style={styles.receiptIcon}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
