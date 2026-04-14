import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface StaffSummaryCardsProps {
  colors: ThemeColors;
  shadowStyle: StyleProp<ViewStyle>;
  stats: {
    active: number;
    pending: number;
    total: number;
  };
}

export function StaffSummaryCards({
  colors,
  shadowStyle,
  stats,
}: StaffSummaryCardsProps) {
  const summaryCards = [
    {
      color: colors.text,
      key: 'total',
      label: 'Total',
      value: stats.total,
    },
    {
      color: colors.success,
      key: 'active',
      label: 'Active',
      value: stats.active,
    },
    {
      color: colors.warning,
      key: 'pending',
      label: 'Pending',
      value: stats.pending,
    },
  ] as const;

  return (
    <View style={styles.summaryRow}>
      {summaryCards.map((card) => (
        <View
          accessibilityLabel={`${card.label} ${card.value} staff`}
          accessibilityRole="text"
          accessible={true}
          key={card.key}
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card },
            shadowStyle,
          ]}
          testID={`${card.key}-card`}
        >
          <Text style={[styles.summaryValue, { color: card.color }]}>
            {card.value}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            {card.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  summaryCard: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    flex: 1,
    padding: SPACING.md,
  },
  summaryValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  summaryLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: SPACING.xs / 2,
  },
});
