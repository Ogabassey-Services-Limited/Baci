/**
 * Analytics Detail Screen
 * Drill-down view for a specific metric with charts and data table
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  type Granularity,
  METRIC_CONFIG,
  type MetricType,
  type TimeSeriesDataPoint,
  useAnalyticsDetail,
} from '@/hooks/useAnalyticsDetail';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';

const GRANULARITY_TABS: { value: Granularity; label: string }[] = [
  { value: 'hourly', label: 'HOURLY' },
  { value: 'weekday', label: 'WEEK DAY' },
  { value: 'month', label: 'MONTH' },
];

// Bar Chart Component
function BarChart({
  data,
  comparisonData,
  selectedIndex,
  onSelectBar,
  accentColor,
  secondaryColor,
  gridColor,
  labelColor,
  formatTick,
}: {
  data: TimeSeriesDataPoint[];
  comparisonData?: TimeSeriesDataPoint[];
  selectedIndex: number | null;
  onSelectBar: (index: number) => void;
  accentColor: string;
  secondaryColor: string;
  gridColor: string;
  labelColor: string;
  formatTick: (amount: number) => string;
}) {
  const chartWidth = 340;
  const chartHeight = 180;
  const padding = { top: 20, right: 10, bottom: 30, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxValue = Math.max(
    ...data.map((d) => d.value),
    ...(comparisonData?.map((d) => d.value) || []),
    1
  );

  const barWidth = (innerWidth / data.length) * 0.6;
  const barGap = (innerWidth / data.length) * 0.4;

  // Y-axis ticks
  const yTicks = [0, maxValue / 2, maxValue];

  return (
    <Svg width={chartWidth} height={chartHeight}>
      {/* Grid Lines (Horizontal) */}
      {yTicks.map((tick, i) => {
        const y = padding.top + innerHeight - (tick / maxValue) * innerHeight;
        return (
          <G key={i}>
            <Rect
              x={padding.left}
              y={y}
              width={innerWidth}
              height={1}
              fill={gridColor}
            />
            <SvgText
              x={padding.left - 8}
              y={y + 4}
              fontSize={10}
              fill={labelColor}
              textAnchor="end"
            >
              {formatTick(tick)}
            </SvgText>
          </G>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = padding.left + i * (barWidth + barGap) + barGap / 2;
        const barHeight = (d.value / maxValue) * innerHeight;
        const y = padding.top + innerHeight - barHeight;
        const isSelected = selectedIndex === i;

        return (
          <G key={i}>
            {/* Comparison bar (lighter, behind) */}
            {comparisonData?.[i] && (
              <Rect
                x={x - 2}
                y={
                  padding.top +
                  innerHeight -
                  (comparisonData[i].value / maxValue) * innerHeight
                }
                width={barWidth}
                height={(comparisonData[i].value / maxValue) * innerHeight}
                fill={secondaryColor}
                opacity={0.3}
                rx={3}
              />
            )}
            {/* Main bar */}
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 0)} // Ensure visible line if 0? No, accurate 0 is fine with grid
              fill={isSelected ? accentColor : `${accentColor}CC`}
              rx={3}
              onPress={() => onSelectBar(i)}
            />
            {/* X-axis label */}
            {/* Show label only for some items if too crowded */}
            {(data.length <= 12 || i % Math.ceil(data.length / 6) === 0) && (
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight - 8}
                fontSize={9}
                fill={labelColor}
                textAnchor="middle"
              >
                {d.label.slice(0, 3)}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

export default function AnalyticsDetailScreen() {
  const { colors, isDark } = useTheme();
  const { format: formatCurrency, formatCompact } = useCurrency();
  const router = useRouter();
  const {
    endDate,
    filterLabel,
    metric: metricParam,
    startDate,
  } = useLocalSearchParams<{
    endDate?: string;
    filterLabel?: string;
    metric: string;
    startDate?: string;
  }>();
  const metric: MetricType =
    typeof metricParam === 'string' && metricParam in METRIC_CONFIG
      ? (metricParam as MetricType)
      : 'revenue';

  const [granularity, setGranularity] = useState<Granularity>('month');
  const [showComparison, setShowComparison] = useState(false);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const { data: analyticsData, isLoading } = useAnalyticsDetail({
    endDate: endDate ?? now.toISOString(),
    filterLabel: filterLabel ?? 'Selected period',
    metric,
    granularity,
    startDate: startDate ?? defaultStart.toISOString(),
    includeComparison: showComparison,
  });

  const config = METRIC_CONFIG[metric];

  const handleShare = async () => {
    if (!analyticsData) return;

    const summary = `${config.title} for ${analyticsData.rangeLabel}: ${formatCurrency(analyticsData.total)}${
      analyticsData.percentChange !== undefined
        ? ` (${analyticsData.percentChange >= 0 ? '+' : ''}${analyticsData.percentChange.toFixed(1)}% vs previous period)`
        : ''
    }`;

    try {
      await Share.share({
        message: summary,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  // Highlight row in table when bar is selected
  const highlightedLabel =
    selectedBarIndex !== null && analyticsData?.data[selectedBarIndex]?.label;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: config.title,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ marginRight: SPACING.md }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={handleShare} style={{ marginLeft: SPACING.md }}>
              <Ionicons name="share-outline" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        {isLoading && (
          <View
            style={[
              styles.loadingOverlay,
              {
                backgroundColor: isDark
                  ? 'rgba(13,13,26,0.5)'
                  : 'rgba(255,255,255,0.5)',
              },
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* Period Selector */}
        <View
          style={[
            styles.yearSelector,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.yearDisplay}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={[styles.yearText, { color: colors.text }]}>
              {filterLabel ?? 'Selected period'}
            </Text>
          </View>
        </View>

        {/* Granularity Tabs */}
        <View style={styles.tabContainer}>
          {GRANULARITY_TABS.map((tab) => (
            <Pressable
              key={tab.value}
              style={[
                styles.tab,
                granularity === tab.value && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => {
                setGranularity(tab.value);
                setSelectedBarIndex(null);
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      granularity === tab.value
                        ? colors.primary
                        : colors.textSecondary,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Total Display */}
          <View style={styles.totalSection}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Total:
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {metric === 'sales'
                ? analyticsData?.total.toLocaleString() || '0'
                : formatCurrency(analyticsData?.total || 0)}
            </Text>
            {analyticsData?.percentChange !== undefined && (
              <View
                style={[
                  styles.changeBadge,
                  {
                    backgroundColor:
                      analyticsData.percentChange >= 0
                        ? colors.successLight
                        : colors.errorLight,
                  },
                ]}
              >
                <Ionicons
                  name={
                    analyticsData.percentChange >= 0
                      ? 'trending-up'
                      : 'trending-down'
                  }
                  size={14}
                  color={
                    analyticsData.percentChange >= 0
                      ? colors.success
                      : colors.error
                  }
                />
                <Text
                  style={{
                    color:
                      analyticsData.percentChange >= 0
                        ? colors.success
                        : colors.error,
                    fontSize: 12,
                  }}
                >
                  {analyticsData.percentChange >= 0 ? '+' : ''}
                  {analyticsData.percentChange.toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          {/* Comparison Toggle */}
          <Pressable
            style={[styles.comparisonToggle, { backgroundColor: colors.card }]}
            onPress={() => setShowComparison(!showComparison)}
          >
            <Ionicons
              name={showComparison ? 'checkbox' : 'square-outline'}
              size={20}
              color={showComparison ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[styles.comparisonText, { color: colors.textSecondary }]}
            >
              Compare vs previous period
            </Text>
          </Pressable>

          {/* Bar Chart */}
          {analyticsData && (
            <View
              style={[styles.chartContainer, { backgroundColor: colors.card }]}
            >
              <BarChart
                data={analyticsData.data}
                comparisonData={
                  showComparison ? analyticsData.comparisonData : undefined
                }
                selectedIndex={selectedBarIndex}
                onSelectBar={setSelectedBarIndex}
                accentColor={colors.primary}
                secondaryColor={colors.textMuted}
                gridColor={colors.border}
                labelColor={colors.textMuted}
                formatTick={formatCompact}
              />
            </View>
          )}

          {/* Insight Banner */}
          {analyticsData?.bestPeriod && (
            <View
              style={[
                styles.insightBanner,
                { backgroundColor: colors.successLight },
              ]}
            >
              <Ionicons name="trending-up" size={16} color={colors.success} />
              <Text style={[styles.insightText, { color: colors.success }]}>
                {analyticsData.bestPeriod.label} was your best{' '}
                {granularity === 'month' ? 'month' : 'period'}:{' '}
                {metric === 'sales'
                  ? analyticsData.bestPeriod.value.toLocaleString()
                  : formatCurrency(analyticsData.bestPeriod.value)}
              </Text>
            </View>
          )}

          {/* Data Table */}
          <View
            style={[styles.tableContainer, { backgroundColor: colors.card }]}
          >
            {/* Table Header */}
            <View
              style={[styles.tableHeader, { borderBottomColor: colors.border }]}
            >
              <Text
                style={[
                  styles.tableHeaderCell,
                  styles.labelColumn,
                  { color: colors.textSecondary },
                ]}
              >
                {granularity === 'month'
                  ? 'MONTH'
                  : granularity === 'weekday'
                    ? 'DAY'
                    : 'HOUR'}
              </Text>
              {config.columns.map((col) => (
                <Text
                  key={col.key}
                  style={[
                    styles.tableHeaderCell,
                    styles.valueColumn,
                    { color: colors.textSecondary },
                  ]}
                >
                  {col.label.toUpperCase()}
                </Text>
              ))}
            </View>

            {/* Table Rows */}
            {analyticsData?.data.map((row, index) => (
              <Pressable
                key={row.label}
                style={[
                  styles.tableRow,
                  { borderBottomColor: colors.border },
                  highlightedLabel === row.label && {
                    backgroundColor: `${colors.primary}15`,
                  },
                ]}
                onPress={() => setSelectedBarIndex(index)}
              >
                <Text
                  style={[
                    styles.tableCell,
                    styles.labelColumn,
                    { color: colors.text },
                  ]}
                >
                  {row.label}
                </Text>
                {config.columns.map((col) => {
                  const value =
                    ((row as unknown as Record<string, unknown>)[
                      col.key
                    ] as number) ?? 0;
                  let formatted: string;
                  if (col.format === 'currency') {
                    formatted = formatCurrency(value);
                  } else if (col.format === 'percent') {
                    formatted = `${value.toFixed(1)}%`;
                  } else {
                    formatted = value.toLocaleString();
                  }
                  return (
                    <Text
                      key={col.key}
                      style={[
                        styles.tableCell,
                        styles.valueColumn,
                        { color: colors.text },
                      ]}
                    >
                      {formatted}
                    </Text>
                  );
                })}
              </Pressable>
            ))}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  yearDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  yearText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  tabText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  scrollView: {
    flex: 1,
  },
  totalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  totalLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  totalValue: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  comparisonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  comparisonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  chartContainer: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  insightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  insightText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flex: 1,
  },
  tableContainer: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  labelColumn: {
    width: 60,
  },
  valueColumn: {
    flex: 1,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableCell: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  bottomSpacer: {
    height: 100,
  },
});
