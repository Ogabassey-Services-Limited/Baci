import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import { styles } from '@/components/transactions/transactions.styles';
import type { ThemeColors } from '@/constants/theme';
import {
  type AnalyticsDateFilter,
  getAnalyticsFilterLabel,
} from '@/lib/analytics-period';

export type TransactionReviewTab = 'missing-costs' | 'paid';

interface TransactionsSummaryProps {
  activeTab: TransactionReviewTab;
  colors: ThemeColors;
  estimatedProfitLabel: string;
  onTabChange: (tab: TransactionReviewTab) => void;
  onPeriodPress: () => void;
  selectedPeriod: AnalyticsDateFilter;
  summary: {
    missingCosts: number;
    transactions: number;
  };
}

export function TransactionsSummary({
  activeTab,
  colors,
  estimatedProfitLabel,
  onTabChange,
  onPeriodPress,
  selectedPeriod,
  summary,
}: TransactionsSummaryProps) {
  const periodLabel = getAnalyticsFilterLabel(selectedPeriod);

  return (
    <>
      <View style={styles.summaryRow}>
        <Pressable
          accessibilityLabel={`Paid transactions: ${summary.transactions}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'paid' }}
          onPress={() => onTabChange('paid')}
          style={[
            styles.summaryCard,
            {
              backgroundColor:
                activeTab === 'paid' ? colors.primaryLight : colors.card,
              borderColor:
                activeTab === 'paid' ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Paid transactions
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {summary.transactions}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Missing costs: ${summary.missingCosts}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'missing-costs' }}
          onPress={() => onTabChange('missing-costs')}
          style={[
            styles.summaryCard,
            {
              backgroundColor:
                activeTab === 'missing-costs' ? colors.errorLight : colors.card,
              borderColor:
                activeTab === 'missing-costs' ? colors.error : colors.border,
            },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Missing costs
          </Text>
          <Text style={[styles.summaryValue, { color: colors.error }]}>
            {summary.missingCosts}
          </Text>
        </Pressable>
      </View>

      <View
        accessible
        accessibilityLabel={`Estimated profit (${periodLabel}): ${estimatedProfitLabel}. Update product cost prices so analytics profit stays grounded in actual margins.`}
        style={[
          styles.heroCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.heroHeader}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Estimated profit
          </Text>
          <Pressable
            accessibilityLabel={`Change period: currently showing ${periodLabel}`}
            accessibilityRole="button"
            onPress={onPeriodPress}
            style={({ pressed }) => [
              styles.periodDropdownButton,
              {
                backgroundColor: colors.primaryLight,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text
              style={[styles.periodDropdownText, { color: colors.primary }]}
            >
              {periodLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.primary} />
          </Pressable>
        </View>
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
