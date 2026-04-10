import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAnalyticsOverview } from '@/hooks/useAnalyticsOverview';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';

interface InsightRow {
  id: string;
  label: string;
  value: string;
}

function parseDateParam(value: string | undefined, fallback: Date): Date {
  if (!value || value.trim() === '') {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default function AnalyticsInsightsScreen() {
  const { colors, isDark } = useTheme();
  const { format: formatCurrency } = useCurrency();
  const params = useLocalSearchParams<{
    endDate?: string;
    filterLabel?: string;
    kind?: string;
    startDate?: string;
  }>();
  const now = new Date();
  const range = {
    endDate: parseDateParam(params.endDate, now),
    startDate: parseDateParam(params.startDate, now),
  };
  const { data: analytics, isLoading, error } = useAnalyticsOverview(range);

  const titles: Record<string, string> = {
    blog: 'Blog Analytics',
    brands: 'Top Vendors',
    customers: 'Top Customers',
    'payment-methods': 'Payment Methods',
  };

  const formatCurrencyCompact = (amount: number) =>
    formatCurrency(amount, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const buildRows = (): InsightRow[] => {
    switch (params.kind) {
      case 'brands':
        return (analytics?.brandBreakdown ?? []).map((item, index) => ({
          id: `brand-${index}`,
          label: item.name,
          value: formatCurrencyCompact(item.revenue ?? item.value ?? 0),
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
          value: formatCurrencyCompact(item.value ?? 0),
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

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={32}
            color={colors.error}
          />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Unable to load analytics right now. Pull to refresh or try again.
          </Text>
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
            {params.filterLabel || 'Selected period'}
          </Text>
          {params.kind === 'blog' ? (
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
                Ranked breakdown for{' '}
                {params.filterLabel || 'the selected period'}
              </Text>
            </>
          )}
        </View>

        {rows.map((row, index) => (
          <View
            key={`${params.kind}-${row.id}-${index}`}
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
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: titles[params.kind || 'blog'] || 'Analytics',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <ScrollView contentContainerStyle={styles.content}>
          {renderBody()}
          <View style={styles.footerSpace} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  footerSpace: {
    height: SPACING.xl,
  },
  heroCard: {
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  heroEyebrow: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
  heroValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['3xl'],
  },
  inlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  inlineText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  row: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  rowLabel: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
    paddingRight: SPACING.md,
  },
  rowValue: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  stateContainer: {
    alignItems: 'center',
    gap: SPACING.md,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  stateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
});
