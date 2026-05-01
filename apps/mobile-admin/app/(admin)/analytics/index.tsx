/**
 * Analytics Screen
 * Comprehensive analytics dashboard inspired by modern e-commerce analytics
 */

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import ReportSelectionModal from '@/components/analytics/ReportSelectionModal';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAnalyticsOverview } from '@/hooks/useAnalyticsOverview';
import { useCurrency } from '@/hooks/useCurrency';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import {
  type AnalyticsDateFilter,
  getAnalyticsFilterLabel,
  resolveAnalyticsDateRange,
} from '@/lib/analytics-period';

const DATE_FILTERS: { value: AnalyticsDateFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
];

// Mini sparkline component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;

  const width = 100;
  const height = 32;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return { x, y };
  });

  const pathD = points.reduce((acc, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1];
    const cpX = (prev.x + point.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${point.y}, ${point.x} ${point.y}`;
  }, '');

  return (
    <Svg width={width} height={height}>
      <Path d={pathD} stroke={color} strokeWidth={2} fill="none" />
      {/* End dot */}
      <Path
        d={`M ${points[points.length - 1].x - 4} ${points[points.length - 1].y} a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0`}
        fill={color}
      />
    </Svg>
  );
}

export default function AnalyticsScreen() {
  const { colors, isDark } = useTheme();
  const { merchant } = useMerchant();
  const { formatCompact } = useCurrency();
  const router = useRouter();
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] =
    useState<AnalyticsDateFilter>('this_year');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(
    null
  );

  // Use brand primary color instead of hardcoded teal
  const ACCENT_COLOR = colors.primary;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };
  const range = resolveAnalyticsDateRange(
    dateFilter,
    selectedYear,
    customStartDate,
    customEndDate
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useAnalyticsOverview(range);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchAnalytics();
    } finally {
      setIsRefreshing(false);
    }
  };

  const chartRevenue = analytics?.chartData.map((point) => point.revenue) ?? [];
  const chartOrders =
    analytics?.chartData.map((point) => point.orders ?? 0) ?? [];
  const chartProfit =
    analytics?.chartData.map((point) => point.profit ?? 0) ?? [];
  const chartTax = analytics?.chartData.map((point) => point.tax ?? 0) ?? [];
  const chartAov =
    analytics?.chartData.map((point) =>
      point.orders ? point.revenue / point.orders : 0
    ) ?? [];

  const getResolvedFilterLabel = () => {
    if (dateFilter === 'custom') {
      return `${formatDate(range.startDate)} - ${formatDate(range.endDate)}`;
    }

    const currentYear = new Date().getFullYear();
    if (
      (dateFilter === 'this_year' || dateFilter === 'last_year') &&
      selectedYear !== currentYear
    ) {
      return selectedYear.toString();
    }

    return getAnalyticsFilterLabel(dateFilter);
  };

  const buildAnalyticsParams = () => ({
    endDate: range.endDate.toISOString(),
    filterLabel: getResolvedFilterLabel(),
    startDate: range.startDate.toISOString(),
  });

  const pushMetricDetail = (metric: string) => {
    router.push({
      pathname: '/analytics/[metric]',
      params: { metric, ...buildAnalyticsParams() },
    });
  };

  const pushInsightDetail = (kind: string) => {
    router.push({
      pathname: '/analytics/insights',
      params: { kind, ...buildAnalyticsParams() },
    });
  };

  const pushProducts = () => {
    router.push({
      pathname: '/analytics/products',
      params: buildAnalyticsParams(),
    });
  };

  const MetricRow = ({
    label,
    value,
    subtitle,
    sparklineData,
    showCircle = false,
    circlePercentage = 0,
    onPress,
  }: {
    label: string;
    value: string;
    subtitle: string;
    sparklineData?: number[];
    isPercentage?: boolean;
    showCircle?: boolean;
    circlePercentage?: number;
    onPress?: () => void;
  }) => (
    <Pressable
      style={[styles.metricRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.metricLeft}>
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.metricValue, { color: ACCENT_COLOR }]}>
          {value}
        </Text>
        <Text style={[styles.metricSubtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.metricRight}>
        {sparklineData && (
          <Sparkline data={sparklineData} color={ACCENT_COLOR} />
        )}
        {showCircle && (
          <View style={styles.circleContainer}>
            <Svg width={50} height={50}>
              <Path
                d="M 25 5 A 20 20 0 1 1 24.99 5"
                stroke={colors.border}
                strokeWidth={4}
                fill="none"
              />
              <Path
                d="M 25 5 A 20 20 0 1 1 24.99 5"
                stroke={ACCENT_COLOR}
                strokeWidth={4}
                fill="none"
                strokeDasharray={`${circlePercentage * 1.26} 126`}
              />
            </Svg>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </Pressable>
  );

  const TopItemRow = ({
    label,
    name,
    subtitle,
    onPress,
  }: {
    label: string;
    name: string;
    subtitle: string;
    onPress?: () => void;
  }) => (
    <Pressable
      style={[styles.metricRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.metricLeft}>
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text
          style={[styles.topItemName, { color: ACCENT_COLOR }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={[styles.metricSubtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.metricRight}>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </Pressable>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false, // Hide default header as we're creating a custom one
        }}
      />
      <SystemBars style={isDark ? 'light' : 'dark'} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.border, borderBottomWidth: 1 },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Analytics
          </Text>

          {/* Reports Button - Right side */}
          <Pressable
            style={[styles.reportButton]}
            onPress={() => setReportModalVisible(true)}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={colors.text}
            />
            <Text style={[styles.reportButtonText, { color: colors.text }]}>
              Report
            </Text>
          </Pressable>
        </View>

        {/* Year Selector - Below header */}
        <View style={[styles.yearSelector, { borderColor: colors.border }]}>
          <Pressable
            onPress={() => {
              if (dateFilter === 'this_year') {
                setSelectedYear((y) => y - 1);
              }
            }}
            style={styles.yearArrow}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={
                dateFilter === 'this_year' ? colors.text : colors.textMuted
              }
            />
          </Pressable>
          <Pressable
            onPress={() => setShowDateFilter(true)}
            style={[
              styles.yearCenter,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.primary}
            />
            <Text
              style={[styles.yearText, { color: colors.text }]}
              numberOfLines={1}
            >
              {getResolvedFilterLabel()}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => {
              if (
                dateFilter === 'this_year' &&
                selectedYear < new Date().getFullYear()
              ) {
                setSelectedYear((y) => y + 1);
              }
            }}
            style={styles.yearArrow}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={
                dateFilter === 'this_year' &&
                selectedYear < new Date().getFullYear()
                  ? colors.text
                  : colors.textMuted
              }
            />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {isAnalyticsLoading && !analytics && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}

          {!isAnalyticsLoading && !analytics && (
            <View style={styles.loadingContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={32}
                color={colors.error}
              />
              <Text
                style={[
                  styles.retryStateText,
                  { color: colors.textSecondary, marginBottom: 12 },
                ]}
              >
                {analyticsError
                  ? 'Unable to load analytics right now.'
                  : 'Analytics are unavailable right now.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading analytics"
                onPress={() => {
                  void refetchAnalytics();
                }}
                style={[
                  styles.retryButton,
                  {
                    alignSelf: 'center',
                    backgroundColor: colors.primary,
                    paddingHorizontal: 18,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.retryButtonText,
                    { color: colors.textOnPrimary },
                  ]}
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          )}

          {analyticsError && analytics && (
            <View
              style={[
                styles.retryBanner,
                {
                  backgroundColor: colors.warningLight,
                  borderColor: colors.warning,
                },
              ]}
            >
              <Text style={[styles.retryStateText, { color: colors.text }]}>
                Unable to refresh analytics. Showing the last loaded data.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry refreshing analytics"
                onPress={() => {
                  void refetchAnalytics();
                }}
                style={[
                  styles.retryButton,
                  { backgroundColor: colors.primary, marginTop: 12 },
                ]}
              >
                <Text
                  style={[
                    styles.retryButtonText,
                    { color: colors.textOnPrimary },
                  ]}
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          )}

          {analytics && (
            <>
              {/* Metrics */}
              <MetricRow
                label="Revenue"
                value={formatCompact(analytics.summary.revenue.value)}
                subtitle={`${analytics.summary.sales.value} paid orders`}
                sparklineData={chartRevenue}
                onPress={() => pushMetricDetail('revenue')}
              />

              <MetricRow
                label="Sales"
                value={String(analytics.summary.sales.value)}
                subtitle={`${analytics.summary.totalUnitsSold} units sold`}
                sparklineData={chartOrders}
                onPress={() => pushMetricDetail('sales')}
              />

              <MetricRow
                label="Average Order Value"
                value={formatCompact(analytics.summary.aov.value)}
                subtitle={`${analytics.summary.customers.value} buying customers`}
                sparklineData={chartAov}
                onPress={() => pushMetricDetail('aov')}
              />

              <MetricRow
                label="Profits"
                value={formatCompact(analytics.summary.profit.value)}
                subtitle={`${analytics.summary.grossMargin.value.toFixed(1)}% gross margin`}
                sparklineData={chartProfit}
                onPress={() => pushMetricDetail('profits')}
              />

              <MetricRow
                label="VAT Due"
                value={formatCompact(analytics.summary.taxDue.value)}
                subtitle="Calculated VAT"
                sparklineData={chartTax}
                onPress={() => pushMetricDetail('vat')}
              />

              <MetricRow
                label="Gross Margin"
                value={`${analytics.summary.grossMargin.value.toFixed(1)}%`}
                subtitle={formatCompact(analytics.summary.profit.value)}
                showCircle
                circlePercentage={analytics.summary.grossMargin.value}
                onPress={() => pushMetricDetail('profits')}
              />

              <MetricRow
                label="Payment method"
                value={`${(analytics.topPaymentMethod?.value ?? 0).toFixed(1)}%`}
                subtitle={`Paid by ${analytics.topPaymentMethod?.name ?? 'N/A'}`}
                showCircle
                circlePercentage={analytics.topPaymentMethod?.value ?? 0}
                onPress={() => pushInsightDetail('payment-methods')}
              />

              <MetricRow
                label="Blog Views"
                value={analytics.blog.totalViews.toLocaleString()}
                subtitle={`${analytics.blog.publishedPosts} published posts`}
                onPress={() => pushInsightDetail('blog')}
              />

              {/* Top Items */}
              {analytics.topBrand && (
                <TopItemRow
                  label="Top Vendor"
                  name={analytics.topBrand.name}
                  subtitle={`#1 in Sales: ${formatCompact(analytics.topBrand.revenue ?? 0)}`}
                  onPress={() => pushInsightDetail('brands')}
                />
              )}

              {analytics.topProducts[0] && (
                <TopItemRow
                  label="Top products"
                  name={analytics.topProducts[0].name}
                  subtitle={`#1 in Sales: ${formatCompact(analytics.topProducts[0].revenue)}`}
                  onPress={pushProducts}
                />
              )}

              {analytics.topCustomer && (
                <TopItemRow
                  label="Top customers"
                  name={analytics.topCustomer.name}
                  subtitle={`#1 in Purchases: ${analytics.topCustomer.value} orders`}
                  onPress={() => pushInsightDetail('customers')}
                />
              )}
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Date Filter Modal */}
        <Modal
          visible={showDateFilter}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDateFilter(false)}
        >
          <SafeAreaView
            style={[
              styles.modalContainer,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowDateFilter(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Filter by Date
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.dateRangeSection}>
                <View style={styles.dateRangeHeader}>
                  <View style={styles.dateRangeHeaderLeft}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.dateRangeTitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Custom date range
                    </Text>
                  </View>
                  {dateFilter === 'custom' && (
                    <Pressable
                      style={styles.clearDateButton}
                      onPress={() => {
                        setDateFilter('this_year');
                        setCustomStartDate(new Date());
                        setCustomEndDate(new Date());
                        setShowDatePicker(null);
                      }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={22}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  )}
                </View>
                <Pressable
                  style={[
                    styles.dateInput,
                    { borderBottomColor: colors.border },
                    showDatePicker === 'start' && {
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                  onPress={() =>
                    setShowDatePicker(
                      showDatePicker === 'start' ? null : 'start'
                    )
                  }
                >
                  <Text
                    style={[
                      styles.dateInputText,
                      {
                        color:
                          dateFilter === 'custom' || showDatePicker === 'start'
                            ? colors.text
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {dateFilter === 'custom' || showDatePicker === 'start'
                      ? formatDate(customStartDate)
                      : 'Start date'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.dateInput,
                    { borderBottomColor: colors.border },
                    showDatePicker === 'end' && {
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                  onPress={() =>
                    setShowDatePicker(showDatePicker === 'end' ? null : 'end')
                  }
                >
                  <Text
                    style={[
                      styles.dateInputText,
                      {
                        color:
                          dateFilter === 'custom' || showDatePicker === 'end'
                            ? colors.text
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {dateFilter === 'custom' || showDatePicker === 'end'
                      ? formatDate(customEndDate)
                      : 'End date'}
                  </Text>
                </Pressable>
              </View>

              <View
                style={[styles.presetGrid, { borderTopColor: colors.border }]}
              >
                {DATE_FILTERS.map((filter, index) => (
                  <Pressable
                    key={filter.value}
                    style={[
                      styles.presetButton,
                      index % 2 === 0 && {
                        borderRightColor: colors.border,
                        borderRightWidth: 1,
                      },
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={() => {
                      setDateFilter(filter.value);
                      setShowDateFilter(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        {
                          color:
                            dateFilter === filter.value
                              ? ACCENT_COLOR
                              : colors.text,
                        },
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Modal Footer - only show when date picker is not open */}
            {!showDatePicker && (
              <View style={styles.modalFooter}>
                <Pressable
                  style={[
                    styles.applyButton,
                    {
                      backgroundColor:
                        dateFilter === 'custom'
                          ? colors.primary
                          : colors.cardHover,
                    },
                  ]}
                  onPress={() => setShowDateFilter(false)}
                >
                  <Text
                    style={[
                      styles.applyButtonText,
                      {
                        color:
                          dateFilter === 'custom'
                            ? '#FFFFFF'
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {dateFilter === 'custom' ? 'Apply Custom Range' : 'Close'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Bottom Date Picker Overlay */}
            {showDatePicker && (
              <View
                style={[
                  styles.bottomDatePicker,
                  {
                    backgroundColor: colors.card,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <DateTimePicker
                  value={
                    showDatePicker === 'start' ? customStartDate : customEndDate
                  }
                  mode="date"
                  display="spinner"
                  themeVariant={isDark ? 'dark' : 'light'}
                  maximumDate={new Date()}
                  onChange={(_event, selectedDate) => {
                    if (selectedDate) {
                      if (showDatePicker === 'start') {
                        setCustomStartDate(selectedDate);
                      } else {
                        setCustomEndDate(selectedDate);
                      }
                      setDateFilter('custom');
                    }
                  }}
                  style={{ height: 200 }}
                />
                <View style={styles.bottomDatePickerActions}>
                  <Pressable
                    style={[
                      styles.confirmButton,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setShowDatePicker(null)}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>

      {analytics && merchant?.id && (
        <ReportSelectionModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          analyticsData={analytics}
          merchantId={merchant.id}
          merchantName={merchant?.business_name || 'My Store'}
          startDate={range.startDate}
          endDate={range.endDate}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  loadingContainer: {
    paddingVertical: SPACING['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryStateText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  retryBanner: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    zIndex: 10, // Ensure it's above everything
    backgroundColor: 'transparent', // Or colors.background via style array
  },
  headerButton: { padding: SPACING.sm },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    flex: 1, // Push report button to the end
    marginLeft: SPACING.xs,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm, // Increased from xs
    paddingHorizontal: SPACING.md, // Increased from sm
  },
  reportButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  yearArrow: { padding: SPACING.xs },
  yearCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  yearText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },

  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
  },
  metricLeft: { flex: 1 },
  metricLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  metricRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  circleContainer: {
    width: 50,
    height: 50,
  },

  topItemName: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 4,
  },

  content: {
    paddingBottom: 100, // Extra space for scrolling
  },
  bottomSpacer: { height: 40 },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  modalContent: { flex: 1, paddingTop: SPACING.xl },
  dateRangeSection: {
    alignItems: 'center',
    paddingBottom: SPACING.xl,
  },
  dateRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '60%',
    marginBottom: SPACING.lg,
  },
  dateRangeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  clearDateButton: {
    padding: SPACING.xs,
  },
  dateRangeTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  dateInput: {
    width: '60%',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  dateInputText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
  },
  presetButton: {
    width: '50%',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
  },
  presetText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  modalFooter: {
    padding: SPACING.lg,
    paddingBottom: SPACING['2xl'],
  },
  applyButton: {
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  // Bottom Date Picker Overlay
  bottomDatePicker: {
    borderTopWidth: 1,
    paddingBottom: SPACING['2xl'],
  },
  bottomDatePickerActions: {
    paddingHorizontal: SPACING.lg,
  },
  confirmButton: {
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
