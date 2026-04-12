import { Text, View } from 'react-native';
import { styles } from '@/components/transactions/transactions.styles';
import type { ThemeColors } from '@/constants/theme';

interface TransactionsSummaryProps {
  colors: ThemeColors;
  estimatedProfitLabel: string;
  summary: {
    missingCosts: number;
    transactions: number;
  };
}

export function TransactionsSummary({
  colors,
  estimatedProfitLabel,
  summary,
}: TransactionsSummaryProps) {
  return (
    <>
      <View style={styles.summaryRow}>
        <View
          accessible
          accessibilityLabel={`Paid transactions: ${summary.transactions}`}
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Paid transactions
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {summary.transactions}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={`Missing costs: ${summary.missingCosts}`}
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Missing costs
          </Text>
          <Text style={[styles.summaryValue, { color: colors.error }]}>
            {summary.missingCosts}
          </Text>
        </View>
      </View>

      <View
        accessible
        accessibilityLabel={`Estimated profit: ${estimatedProfitLabel}. Update product cost prices so analytics profit stays grounded in actual margins.`}
        style={[
          styles.heroCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Estimated profit
        </Text>
        <Text style={[styles.heroValue, { color: colors.text }]}>
          {estimatedProfitLabel}
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
          Update product cost prices so analytics profit stays grounded in
          actual margins.
        </Text>
      </View>
    </>
  );
}
