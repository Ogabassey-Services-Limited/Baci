/**
 * RevenueChart Component
 * Simple bar chart showing revenue over time (no SVG paths for Android compatibility)
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface DataPoint {
  label: string;
  value: number;
}

interface RevenueChartProps {
  data: DataPoint[];
  title?: string;
  period?: string;
  totalRevenue?: string;
  onPeriodPress?: () => void;
  showPeriodSelector?: boolean;
  insightText?: string;
  insightTrend?: 'up' | 'down' | 'neutral';
}

export function RevenueChart({
  data,
  title = 'Revenue Overview',
  period = 'Last 7 days',
  totalRevenue,
  onPeriodPress,
  showPeriodSelector: _showPeriodSelector = false,
  insightText,
  insightTrend = 'neutral',
}: RevenueChartProps) {
  const { colors, shadows, chartColors } = useTheme();
  // const { width } = Dimensions.get('window');
  // const chartWidth = width - SPACING.lg * 4;
  const chartHeight = 120;

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.card }, shadows.sm]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {onPeriodPress ? (
            <Pressable
              style={styles.periodButton}
              onPress={onPeriodPress}
              accessibilityRole="button"
              accessibilityLabel={`Select period, currently showing ${period}`}
              accessibilityHint="Opens a menu to change the time period for the chart"
              hitSlop={14}
            >
              <Text style={[styles.period, { color: colors.primary }]}>
                {period}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </Pressable>
          ) : (
            <Text style={[styles.period, { color: colors.textSecondary }]}>
              {period}
            </Text>
          )}
        </View>
        {totalRevenue ? (
          <Text style={[styles.totalRevenue, { color: colors.text }]}>
            {totalRevenue}
          </Text>
        ) : null}
      </View>

      {/* Bar Chart */}
      <View style={[styles.chartContainer, { height: chartHeight }]}>
        {/* Grid lines */}
        <View
          style={[styles.gridLine, { top: 0, borderColor: colors.border }]}
        />
        <View
          style={[styles.gridLine, { top: '33%', borderColor: colors.border }]}
        />
        <View
          style={[styles.gridLine, { top: '66%', borderColor: colors.border }]}
        />
        <View
          style={[styles.gridLine, { top: '100%', borderColor: colors.border }]}
        />

        {/* Bars */}
        <View style={styles.barsContainer}>
          {data.map((point, index) => {
            const barHeight = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
            return (
              <View key={index} style={styles.barWrapper}>
                <View style={styles.barArea}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${barHeight}%`,
                        backgroundColor: chartColors.revenue,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: colors.textMuted }]}>
                  {point.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Insight Text */}
      {insightText ? (
        <View style={styles.insightContainer}>
          <Ionicons
            name={
              insightTrend === 'up'
                ? 'trending-up'
                : insightTrend === 'down'
                  ? 'trending-down'
                  : 'remove'
            }
            size={16}
            color={
              insightTrend === 'up'
                ? colors.success
                : insightTrend === 'down'
                  ? colors.error
                  : colors.textMuted
            }
          />
          <Text
            style={[
              styles.insightText,
              {
                color:
                  insightTrend === 'up'
                    ? colors.success
                    : insightTrend === 'down'
                      ? colors.error
                      : colors.textMuted,
              },
            ]}
          >
            {insightText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  period: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: 2,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  totalRevenue: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  chartContainer: {
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  barArea: {
    flex: 1,
    width: '60%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: 4,
  },
  insightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: SPACING.sm, // Reduced from md
    borderTopWidth: 1,
    borderTopColor: 'transparent',
    marginTop: SPACING.xs, // Reduced from sm
  },
  insightText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
