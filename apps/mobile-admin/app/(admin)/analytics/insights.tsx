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
import { baciFeatureGates } from '@/lib/feature-gates';

interface InsightRow {
  id: string;
  label: string;
  value: string;
}

type InsightsRange = {
  endDate: Date;
  startDate: Date;
};

const INSIGHT_TITLES: Record<string, string> = {
  blog: 'Blog Analytics',
  brands: 'Top Vendors',
  customers: 'Top Customers',
  'payment-methods': 'Payment Methods',
};

function parseDateParam(value: string | undefined, fallback: Date): Date {
  if (!value || value.trim() === '') {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

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
  // Match the API's default analytics window when params are absent so we
  // never collapse into a zero-width "now to now" request.
  const [fallbackRange] = useState(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { end, start };
  });
  const startDateParam = getSingleParam(params.startDate);
  const endDateParam = getSingleParam(params.endDate);
  const filterLabelParam = getSingleParam(params.filterLabel);
  const kind = getSingleParam(params.kind) ?? 'blog';
  const parsedStart = parseDateParam(startDateParam, fallbackRange.start);
  const parsedEnd = parseDateParam(endDateParam, fallbackRange.end);
  const range =
    parsedStart.getTime() <= parsedEnd.getTime()
      ? { endDate: parsedEnd, startDate: parsedStart }
      : { endDate: parsedStart, startDate: parsedEnd };
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
      <FeatureGateScreen
        description="Segmented breakdowns and deeper insights are available when Baci Pro is active."
        feature="advanced_analytics"
        title="Advanced analytics are a Baci Pro feature"
      >
        {hasAdvancedAnalytics ? (
          <AnalyticsInsightsContent
            filterLabel={filterLabelParam}
            kind={kind}
            range={range}
          />
        ) : null}
      </FeatureGateScreen>
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
  range: InsightsRange;
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
