import Ionicons from "@react-native-vector-icons/ionicons/static";
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@/utils/format';

interface OrderReportStats {
  completedCount: number;
  pendingCount: number;
  totalOrders: number;
  totalRevenue: number;
}

interface OrderReportStatsPanelProps {
  stats: OrderReportStats;
}

export function OrderReportStatsPanel({ stats }: OrderReportStatsPanelProps) {
  const { colors } = useTheme();

  return (
    <>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.background }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Revenue
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatCurrency(stats.totalRevenue)}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.background }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Orders
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats.totalOrders}
          </Text>
        </View>
      </View>

      <View style={[styles.statsRow, { borderColor: colors.border }]}>
        <View
          style={[
            styles.miniStat,
            { borderColor: colors.border, borderRightWidth: 1 },
          ]}
        >
          <Text style={[styles.miniValue, { color: colors.warning }]}>
            {stats.pendingCount}
          </Text>
          <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>
            Pending
          </Text>
        </View>
        <View style={styles.miniStat}>
          <Text style={[styles.miniValue, { color: colors.success }]}>
            {stats.completedCount}
          </Text>
          <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>
            Delivered
          </Text>
        </View>
      </View>

      <View style={[styles.infoBox, { backgroundColor: colors.infoLight }]}>
        <Ionicons name="information-circle" size={20} color={colors.info} />
        <Text style={[styles.infoText, { color: colors.info }]}>
          Exporting will capture all {stats.totalOrders} currently loaded
          orders.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCard: {
    borderRadius: RADIUS.md,
    flex: 1,
    padding: SPACING.md,
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  statsRow: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  miniStat: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.sm,
  },
  miniValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  miniLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 11,
  },
  infoBox: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  infoText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
