import Ionicons from '@react-native-vector-icons/ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '@/components/analytics/analytics-insights.styles';
import { FeatureGateScreen } from '@/components/billing/FeatureGateScreen';
import { useAnalyticsOverview } from '@/hooks/useAnalyticsOverview';
import { useCurrency } from '@/hooks/useCurrency';
import { useMerchant } from '@/hooks/useMerchant';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useTheme } from '@/hooks/useTheme';
import {
  type AnalyticsDateRange,
  createDefaultAnalyticsDateRange,
  resolveAnalyticsDateRangeParams,
} from '@/lib/analytics-period';
import { baciFeatureGates } from '@/lib/feature-gates';

interface InsightRow {
  id: string;
  label: string;
  value: string;
}

const INSIGHT_TITLES: Record<string, string> = {
  blog: 'Blog Analytics',
  brands: 'Top Vendors',
  customers: 'Top Customers',
  'payment-methods': 'Payment Methods',
  suppliers: 'Supplier Analytics',
};

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AnalyticsInsightsScreen() {
  const { colors } = useTheme();
  const { merchant } = useMerchant();
  const { isPro } = useRevenueCat();
  const params = useLocalSearchParams<{
    endDate?: string | string[];
    filterLabel?: string | string[];
    kind?: string | string[];
    startDate?: string | string[];
  }>();
  const [fallbackRange] = useState(createDefaultAnalyticsDateRange);
  const startDateParam = getSingleParam(params.startDate);
  const endDateParam = getSingleParam(params.endDate);
  const filterLabelParam = getSingleParam(params.filterLabel);
  const kind = getSingleParam(params.kind) ?? 'blog';
  const range = resolveAnalyticsDateRangeParams({
    endDateParam,
    fallbackRange,
    startDateParam,
  });
  const hasAdvancedAnalytics =
    isPro || baciFeatureGates.hasFeature(merchant, 'advanced_analytics');

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: INSIGHT_TITLES[kind] || 'Analytics',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      {hasAdvancedAnalytics ? (
        <AnalyticsInsightsContent
          filterLabel={filterLabelParam}
          kind={kind}
          range={range}
        />
      ) : (
        <FeatureGateScreen
          description="Segmented breakdowns and deeper insights are available when Baci Pro is active."
          feature="advanced_analytics"
          title="Advanced analytics are a Baci Pro feature"
        >
          {null}
        </FeatureGateScreen>
      )}
    </>
  );
}

function AnalyticsInsightsContent({
  filterLabel,
  kind,
  range,
}: {
  filterLabel?: string;
  kind: string;
  range: AnalyticsDateRange;
}) {
  const { colors, isDark } = useTheme();
  const { format: formatCurrency } = useCurrency();
  const {
    data: analytics,
    isLoading,
    error,
    refetch,
  } = useAnalyticsOverview(range);

  const formatCurrencyNoDecimals = (amount: number) =>
    formatCurrency(amount, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const buildRows = (): InsightRow[] => {
    switch (kind) {
      case 'brands':
        return (analytics?.brandBreakdown ?? []).map((item, index) => ({
          id: `brand-${index}`,
          label: item.name,
          value: formatCurrencyNoDecimals(item.revenue ?? item.value ?? 0),
        }));
      case 'customers':
        return (analytics?.customerBreakdown ?? []).map((item, index) => ({
          id: `customer-${index}`,
          label: item.name,
          value: `${(item.value ?? 0).toLocaleString()} orders`,
        }));
      case 'payment-methods':
        return (analytics?.salesByPaymentMethod ?? []).map((item, index) => ({
          id: `payment-${index}`,
          label: item.name,
          value: formatCurrencyNoDecimals(item.value ?? 0),
        }));
      case 'suppliers':
        return (analytics?.supplierAnalytics ?? []).map((item, index) => ({
          id: `supplier-${index}`,
          label: item.supplierName,
          value: `${item.unitCount.toLocaleString()} units - ${formatCurrencyNoDecimals(item.totalCost)} cost`,
        }));
      default:
        return [];
    }
  };

  const rows = buildRows();
  const blogTotalViews = Number(analytics?.blog?.totalViews ?? 0);

  const renderBody = () => {
    if (isLoading && !analytics) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error && !analytics) {
      return (
        <View style={styles.stateContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={32}
            color={colors.error}
          />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Unable to load analytics right now.
          </Text>
          <Pressable
            onPress={() => {
              void refetch();
            }}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.textOnPrimary }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.heroEyebrow, { color: colors.textSecondary }]}>
            {filterLabel || 'Selected period'}
          </Text>
          {kind === 'blog' ? (
            <>
              <Text style={[styles.heroValue, { color: colors.text }]}>
                {blogTotalViews.toLocaleString()}
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                {analytics?.blog?.publishedPosts ?? 0} published posts,{' '}
                {analytics?.blog?.draftPosts ?? 0} drafts
              </Text>
              {analytics?.blog?.topPost ? (
                <View style={styles.inlineRow}>
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.inlineText, { color: colors.textSecondary }]}
                  >
                    Top post: {analytics.blog.topPost.title}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[styles.heroValue, { color: colors.text }]}>
                {rows.length.toLocaleString()}
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                Ranked breakdown for {filterLabel || 'the selected period'}
              </Text>
            </>
          )}
        </View>

        {rows.map((row) => (
          <View
            key={row.id}
            style={[
              styles.row,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {row.label}
            </Text>
            <Text style={[styles.rowValue, { color: colors.primary }]}>
              {row.value}
            </Text>
          </View>
        ))}
      </>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={styles.content}>
        {renderBody()}
        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}
