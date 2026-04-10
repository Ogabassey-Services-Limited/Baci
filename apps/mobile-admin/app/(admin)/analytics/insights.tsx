import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAnalyticsOverview } from '@/hooks/useAnalyticsOverview';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';

function getCurrencySymbol(currencyCode: string | null | undefined) {
  const symbols: Record<string, string> = {
    EUR: '\u20AC',
    GBP: '\u00A3',
    NGN: '\u20A6',
    USD: '$',
  };
  return symbols[currencyCode || 'NGN'] || '\u20A6';
}

export default function AnalyticsInsightsScreen() {
  const { colors, isDark } = useTheme();
  const { merchant } = useMerchant();
  const params = useLocalSearchParams<{
    endDate?: string;
    filterLabel?: string;
    kind?: string;
    startDate?: string;
  }>();
  const currencySymbol = getCurrencySymbol(merchant?.payout_currency);
  const range = {
    endDate: new Date(params.endDate ?? new Date().toISOString()),
    startDate: new Date(params.startDate ?? new Date().toISOString()),
  };
  const { data: analytics } = useAnalyticsOverview(range);

  const titles: Record<string, string> = {
    blog: 'Blog Analytics',
    brands: 'Top Vendors',
    customers: 'Top Customers',
    'payment-methods': 'Payment Methods',
  };

  const rows =
    params.kind === 'brands'
      ? (analytics?.brandBreakdown ?? []).map((item) => ({
          label: item.name,
          value: `${currencySymbol}${(item.revenue ?? item.value).toLocaleString('en-NG', {
            maximumFractionDigits: 0,
          })}`,
        }))
      : params.kind === 'customers'
        ? (analytics?.customerBreakdown ?? []).map((item) => ({
            label: item.name,
            value: `${item.value} orders`,
          }))
        : params.kind === 'payment-methods'
          ? (analytics?.salesByPaymentMethod ?? []).map((item) => ({
              label: item.name,
              value: `${currencySymbol}${item.value.toLocaleString('en-NG', {
                maximumFractionDigits: 0,
              })}`,
            }))
          : [];

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
                  {analytics?.blog.totalViews.toLocaleString('en-NG') ?? '0'}
                </Text>
                <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                  {analytics?.blog.publishedPosts ?? 0} published posts, {analytics?.blog.draftPosts ?? 0} drafts
                </Text>
                {analytics?.blog.topPost ? (
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
                  {rows.length.toLocaleString('en-NG')}
                </Text>
                <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                  Ranked breakdown for {params.filterLabel || 'the selected period'}
                </Text>
              </>
            )}
          </View>

          {rows.map((row) => (
            <View
              key={`${params.kind}-${row.label}`}
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
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
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
    gap: 8,
    marginTop: 4,
  },
  inlineText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  row: {
    borderRadius: 20,
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
});
