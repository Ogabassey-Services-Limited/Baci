import { Text, type TextStyle, View, type ViewStyle } from 'react-native';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';

interface TransactionOrderProfitSummaryProps {
  colors: ThemeColors;
  estimatedProfit: number;
  formatCurrency: (amount: number) => string;
  itemCount: number;
  missingCostCount: number;
}

export function TransactionOrderProfitSummary({
  colors,
  estimatedProfit,
  formatCurrency,
  itemCount,
  missingCostCount,
}: TransactionOrderProfitSummaryProps) {
  if (itemCount <= 1 || missingCostCount >= itemCount) {
    return null;
  }

  const isLoss = estimatedProfit < 0;
  const isNeutral = estimatedProfit === 0;
  const isIncomplete = missingCostCount > 0;
  const labelPrefix = isIncomplete ? 'Estimated' : 'Total';
  const label = `${labelPrefix} ${isLoss ? 'loss' : 'profit'}`;
  const amountLabel = isLoss
    ? `Loss ${formatCurrency(Math.abs(estimatedProfit))}`
    : formatCurrency(estimatedProfit);
  const amountColor = isLoss
    ? colors.error
    : isNeutral
      ? colors.textMuted
      : colors.success;

  return (
    <View
      style={[
        summaryStyles.container,
        {
          backgroundColor: isLoss ? colors.errorLight : colors.successLight,
          borderColor: isLoss ? colors.error : colors.success,
        },
      ]}
    >
      <Text style={[summaryStyles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[summaryStyles.amount, { color: amountColor }]}>
        {amountLabel}
      </Text>
    </View>
  );
}

interface SummaryStyles {
  amount: TextStyle;
  container: ViewStyle;
  label: TextStyle;
}

const summaryStyles: SummaryStyles = {
  amount: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  container: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
};
