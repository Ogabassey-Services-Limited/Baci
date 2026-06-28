import Ionicons from '@react-native-vector-icons/ionicons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FeatureGateScreen } from '@/components/billing/FeatureGateScreen';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useCurrency } from '@/hooks/useCurrency';
import { useMerchant } from '@/hooks/useMerchant';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useTheme } from '@/hooks/useTheme';
import {
  type TopSellingProduct,
  useTopSellingProducts,
} from '@/hooks/useTopSellingProducts';
import {
  type AnalyticsDateRange,
  resolveAnalyticsDateRangeParams,
} from '@/lib/analytics-period';
import { baciFeatureGates } from '@/lib/feature-gates';

const ALL_TIME_END_ISO = '9999-12-31T23:59:59.999Z';

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function createAllTimeAnalyticsDateRange(): AnalyticsDateRange {
  return {
    endDate: new Date(ALL_TIME_END_ISO),
    startDate: new Date(0),
  };
}

export default function AnalyticsProductsScreen() {
  const { colors } = useTheme();
  const { merchant } = useMerchant();
  const { isPro } = useRevenueCat();
  const params = useLocalSearchParams<{
    endDate?: string | string[];
    filterLabel?: string | string[];
    startDate?: string | string[];
  }>();
  const [fallbackRange] = useState(createAllTimeAnalyticsDateRange);
  const startDateParam = getSingleParam(params.startDate);
  const endDateParam = getSingleParam(params.endDate);
  const filterLabelParam = getSingleParam(params.filterLabel);
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
          title: filterLabelParam
            ? `Top Products · ${filterLabelParam}`
            : 'Top Products',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      {hasAdvancedAnalytics ? (
        <AnalyticsProductsContent range={range} />
      ) : (
        <FeatureGateScreen
          description="Product rankings and segmented analytics are available when Baci Pro is active."
          feature="advanced_analytics"
          title="Advanced analytics are a Baci Pro feature"
        >
          {null}
        </FeatureGateScreen>
      )}
    </>
  );
}

function AnalyticsProductsContent({ range }: { range: AnalyticsDateRange }) {
  const { colors, isDark } = useTheme();
  const { format: formatCurrency } = useCurrency();
  const router = useRouter();
  const {
    data: topProducts,
    isError,
    isLoading,
    refetch,
  } = useTopSellingProducts(50, range);

  const renderProductItem = ({
    item,
    index,
  }: {
    item: TopSellingProduct;
    index: number;
  }) => (
    <Pressable
      style={[
        styles.productItem,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
      ]}
      onPress={() => router.push(`/product/${item.id}`)}
    >
      <View style={styles.rankContainer}>
        <Text style={[styles.rankText, { color: colors.textSecondary }]}>
          {index + 1}
        </Text>
      </View>

      <View style={styles.productInfo}>
        <Text
          style={[styles.productName, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={[styles.productStats, { color: colors.textSecondary }]}>
          {item.totalSold} units sold
        </Text>
      </View>

      <View style={styles.productValue}>
        <Text style={[styles.revenueText, { color: colors.text }]}>
          {formatCurrency(item.totalRevenue)}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <FlashList
        data={topProducts}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading && isError ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={colors.error}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Failed to load top products.
              </Text>
              <Pressable
                accessibilityHint="Retries loading the product list"
                accessibilityLabel="Retry fetching products"
                accessibilityRole="button"
                accessible
                onPress={() => {
                  void refetch();
                }}
                style={[
                  styles.retryButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.retryButtonText,
                    { color: colors.textOnPrimary },
                  ]}
                >
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : !isLoading ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="cube-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No product data available for this period.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    height: 63,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankContainer: {
    width: 30,
  },
  rankText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  productInfo: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  productName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 2,
  },
  productStats: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  productValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revenueText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.size.md,
  },
  retryButton: {
    borderRadius: 999,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  retryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
