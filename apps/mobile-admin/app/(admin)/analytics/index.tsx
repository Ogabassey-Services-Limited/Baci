/**
 * Analytics Screen
 * Comprehensive analytics dashboard inspired by modern e-commerce analytics
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatCompactCurrency } from '@/lib/utils';
import ReportSelectionModal from '@/components/analytics/ReportSelectionModal';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import Svg, { Path } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';

type DateFilter =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom';

export interface AnalyticsData {
  revenue: number;
  sales: number;
  avgTicketSize: number;
  salesTax: number;
  profit: number;
  bestMonthRevenue: string;
  bestMonthSales: string;
  bestMonthAOV: string;
  topPaymentMethod: { method: string; percentage: number };
  topProduct: { name: string; revenue: number } | null;
  topBrand: { name: string; revenue: number } | null; // Added topBrand to interface
  topCustomer: { name: string; purchases: number } | null;
  monthlyRevenue: number[];
  monthlySales: number[];
}

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
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
  const { user } = useAuth();
  const router = useRouter();
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('this_year');
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

  // Helper functions to get start and end dates based on filter
  const getStartDate = (
    filter: DateFilter,
    year: number,
    customStart: Date,
    _customEnd: Date
  ): Date => {
    const now = new Date();
    let startDate: Date;

    switch (filter) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = new Date(yesterday.setHours(0, 0, 0, 0));
        break;
      }
      case 'this_week': {
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate = new Date(firstDay.setHours(0, 0, 0, 0));
        break;
      }
      case 'last_week': {
        const lastWeekStart = new Date(
          now.setDate(now.getDate() - now.getDay() - 7)
        );
        startDate = new Date(lastWeekStart.setHours(0, 0, 0, 0));
        break;
      }
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case 'this_year':
        startDate = new Date(year, 0, 1);
        break;
      case 'last_year':
        startDate = new Date(year - 1, 0, 1);
        break;
      case 'custom':
        startDate = customStart;
        break;
      default:
        startDate = new Date(year, 0, 1);
    }
    return startDate;
  };

  const getEndDate = (
    filter: DateFilter,
    year: number,
    customStart: Date,
    customEnd: Date
  ): Date => {
    const now = new Date();
    let endDate: Date;

    switch (filter) {
      case 'today':
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        endDate = new Date(yesterday.setHours(23, 59, 59, 999));
        break;
      }
      case 'this_week':
        endDate = new Date();
        break;
      case 'last_week': {
        const lastWeekEnd = new Date(
          now.setDate(now.getDate() - now.getDay() - 7 + 6)
        );
        endDate = new Date(lastWeekEnd.setHours(23, 59, 59, 999));
        break;
      }
      case 'this_month':
        endDate = new Date();
        break;
      case 'last_month':
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_year':
        endDate = new Date(year, 11, 31, 23, 59, 59);
        break;
      case 'last_year':
        endDate = new Date(year - 1, 11, 31, 23, 59, 59);
        break;
      case 'custom':
        endDate = customEnd;
        break;
      default:
        endDate = new Date(year, 11, 31, 23, 59, 59);
    }
    return endDate;
  };

  // Fetch merchant ID
  const { data: merchant } = useQuery({
    queryKey: ['merchant', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('merchants')
        .select('id, business_name')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch analytics data
  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: [
      'analytics',
      merchant?.id,
      dateFilter,
      selectedYear,
      customStartDate,
      customEndDate,
    ],
    queryFn: async () => {
      if (!merchant?.id) throw new Error('No merchant found');

      const startDate = getStartDate(
        dateFilter,
        selectedYear,
        customStartDate,
        customEndDate
      );
      const endDate = getEndDate(
        dateFilter,
        selectedYear,
        customStartDate,
        customEndDate
      );

      // Fetch orders for the period
      const { data: orders } = await supabase
        .from('orders')
        .select(
          'id, total, tax_amount, payment_status, payment_method, created_at'
        )
        .eq('merchant_id', merchant.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const paidOrders =
        orders?.filter((o) => o.payment_status === 'paid') || [];
      const revenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const sales = paidOrders.length;
      const avgOrderValue = sales > 0 ? revenue / sales : 0;
      const vatDue = paidOrders.reduce(
        (sum, o) => sum + (o.tax_amount || 0),
        0
      );

      // Calculate monthly breakdown for sparklines
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const monthlyRevenue = new Array(12).fill(0);
      const monthlySales = new Array(12).fill(0);

      paidOrders.forEach((order) => {
        const month = new Date(order.created_at).getMonth();
        monthlyRevenue[month] += order.total || 0;
        monthlySales[month] += 1;
      });

      // Find best months
      const maxRevenueMonth = monthlyRevenue.indexOf(
        Math.max(...monthlyRevenue)
      );
      const maxSalesMonth = monthlySales.indexOf(Math.max(...monthlySales));
      const monthlyAOV = monthlyRevenue.map((rev, i) =>
        monthlySales[i] > 0 ? rev / monthlySales[i] : 0
      );
      const maxAOVMonth = monthlyAOV.indexOf(Math.max(...monthlyAOV));

      // Payment method breakdown
      const paymentMethods: Record<string, number> = {};
      paidOrders.forEach((order) => {
        const method = order.payment_method || 'Unknown';
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
      });
      const topMethod = Object.entries(paymentMethods).sort(
        (a, b) => b[1] - a[1]
      )[0];
      const topPaymentMethod = topMethod
        ? {
            method: topMethod[0],
            percentage: sales > 0 ? (topMethod[1] / sales) * 100 : 0,
          }
        : { method: 'N/A', percentage: 0 };

      // Top product, Top Brand & Profit Calculation
      const { data: topProductData } = await supabase
        .from('order_items')
        .select(`
          quantity,
          price,
          products!inner(name, cost_price, brand),
          orders!inner(merchant_id, payment_status, created_at)
        `)
        .eq('orders.merchant_id', merchant.id)
        .eq('orders.payment_status', 'paid')
        .gte('orders.created_at', startDate.toISOString())
        .lte('orders.created_at', endDate.toISOString());

      let totalProfit = 0;
      const productRevenue: Record<string, { name: string; revenue: number }> =
        {};
      const brandRevenue: Record<string, { name: string; revenue: number }> =
        {};

      topProductData?.forEach((item) => {
        const productData = item.products as {
          name: string;
          brand: string;
          cost_price: number;
        }[];
        const product = Array.isArray(productData)
          ? productData[0]
          : productData;
        const name = product.name as string;
        const brand = (product.brand as string) || 'Unknown';
        const cost = (product.cost_price as number) || 0;
        const price = item.price || 0;
        const qty = item.quantity || 1;
        const itemRevenue = qty * price;

        // Calculate Profit: (Price - Cost) * Quantity
        totalProfit += (price - cost) * qty;

        if (productRevenue[name]) {
          productRevenue[name].revenue += itemRevenue;
        } else {
          productRevenue[name] = { name, revenue: itemRevenue };
        }

        if (brandRevenue[brand]) {
          brandRevenue[brand].revenue += itemRevenue;
        } else {
          brandRevenue[brand] = { name: brand, revenue: itemRevenue };
        }
      });

      const topProduct =
        Object.values(productRevenue).sort(
          (a, b) => b.revenue - a.revenue
        )[0] || null;
      const topBrand =
        Object.values(brandRevenue).sort((a, b) => b.revenue - a.revenue)[0] ||
        null;

      // Top customer
      const { data: customerData } = await supabase
        .from('orders')
        .select('customer_id, total, customers!inner(first_name, last_name)')
        .eq('merchant_id', merchant.id)
        .eq('payment_status', 'paid')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const customerPurchases: Record<
        string,
        { name: string; purchases: number }
      > = {};
      customerData?.forEach((order) => {
        const customer = Array.isArray(order.customers)
          ? order.customers[0]
          : order.customers;
        if (!customer) return;
        const name =
          `${customer.first_name} ${customer.last_name}`.trim() || 'Guest';
        if (!customerPurchases[name])
          customerPurchases[name] = { name, purchases: 0 };
        customerPurchases[name].purchases += order.total || 0;
      });
      const topCustomer =
        Object.values(customerPurchases).sort(
          (a, b) => b.purchases - a.purchases
        )[0] || null;

      return {
        revenue,
        sales,
        avgTicketSize: avgOrderValue, // Keeping key for now but value is updated
        salesTax: vatDue, // Mapped to salesTax for now, but UI will show 'VAT Due'
        profit: totalProfit,
        bestMonthRevenue: months[maxRevenueMonth],
        bestMonthSales: months[maxSalesMonth],
        bestMonthAOV: months[maxAOVMonth],
        topPaymentMethod,
        topProduct,
        topBrand,
        topCustomer,
        monthlyRevenue,
        monthlySales,
      };
    },
    enabled: !!merchant?.id,
  });

  const getFilterLabel = () => {
    return (
      DATE_FILTERS.find((f) => f.value === dateFilter)?.label || 'This year'
    );
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
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
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
              {getFilterLabel()}
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
        >
          {/* Metrics */}
          <MetricRow
            label="Revenue"
            value={formatCompactCurrency(analytics?.revenue ?? 0)}
            subtitle={`Best month: ${analytics?.bestMonthRevenue ?? 'N/A'}`}
            sparklineData={analytics?.monthlyRevenue}
            onPress={() => router.push('/analytics/revenue')}
          />

          <MetricRow
            label="Sales"
            value={String(analytics?.sales ?? 0)}
            subtitle={`Best month: ${analytics?.bestMonthSales ?? 'N/A'}`}
            sparklineData={analytics?.monthlySales}
            onPress={() => router.push('/analytics/sales')}
          />

          <MetricRow
            label="Average Order Value"
            value={formatCompactCurrency(analytics?.avgTicketSize ?? 0)}
            subtitle={`Best month: ${analytics?.bestMonthAOV ?? 'N/A'}`}
            sparklineData={analytics?.monthlyRevenue.map((rev, i) =>
              analytics?.monthlySales[i] ? rev / analytics.monthlySales[i] : 0
            )}
            onPress={() => router.push('/analytics/aov')}
          />

          <MetricRow
            label="Profits"
            value={formatCompactCurrency(analytics?.profit ?? 0)}
            subtitle="Net profit"
            sparklineData={analytics?.monthlyRevenue.map((r) => r * 0.2)}
            onPress={() => router.push('/analytics/profits')}
          />

          <MetricRow
            label="VAT Due"
            value={formatCompactCurrency(analytics?.salesTax ?? 0)}
            subtitle="Best month: January"
            sparklineData={[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
            onPress={() => router.push('/analytics/vat')}
          />

          <MetricRow
            label="Payment method"
            value={`${(analytics?.topPaymentMethod.percentage ?? 0).toFixed(2)}%`}
            subtitle={`Paid by ${analytics?.topPaymentMethod.method ?? 'N/A'}`}
            showCircle
            circlePercentage={analytics?.topPaymentMethod.percentage ?? 0}
          />

          {/* Top Items */}
          {analytics?.topBrand && (
            <TopItemRow
              label="Top Vendor"
              name={analytics.topBrand.name}
              subtitle={`#1 in Sales: ${formatCompactCurrency(analytics.topBrand.revenue)}`}
            />
          )}

          {analytics?.topProduct && (
            <TopItemRow
              label="Top products"
              name={analytics.topProduct.name}
              subtitle={`#1 in Sales: ${formatCompactCurrency(analytics.topProduct.revenue)}`}
              onPress={() => router.push('/analytics/products')} // Placeholder route
            />
          )}

          {analytics?.topCustomer && (
            <TopItemRow
              label="Top customers"
              name={analytics.topCustomer.name}
              subtitle={`#1 in Purchases: ${analytics.topCustomer.purchases} Orders`}
            />
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
                  onChange={(event, selectedDate) => {
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

      {analytics && (
        <ReportSelectionModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          analyticsData={analytics}
          merchantName={merchant?.business_name || 'My Store'}
          startDate={getStartDate(
            dateFilter,
            selectedYear,
            customStartDate,
            customEndDate
          )}
          endDate={getEndDate(
            dateFilter,
            selectedYear,
            customStartDate,
            customEndDate
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
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
