import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const SUMMARY_LABEL_MARGIN_TOP = SPACING.xs / 2;

interface StaffSummaryCardsProps {
  active: number;
  pending: number;
  total: number;
}

interface SummaryCardProps {
  label: string;
  value: number;
  valueColor: string;
}

function SummaryCard({ label, value, valueColor }: SummaryCardProps) {
  const { colors, shadows } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label} staff: ${value}`}
      style={[styles.summaryCard, { backgroundColor: colors.card }, shadows.sm]}
    >
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

export function StaffSummaryCards({
  active,
  pending,
  total,
}: StaffSummaryCardsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.summaryRow}>
      <SummaryCard label="Total" value={total} valueColor={colors.text} />
      <SummaryCard label="Active" value={active} valueColor={colors.success} />
      <SummaryCard
        label="Pending"
        value={pending}
        valueColor={colors.warning}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: SUMMARY_LABEL_MARGIN_TOP,
  },
});
