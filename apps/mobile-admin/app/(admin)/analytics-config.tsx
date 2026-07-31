import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalyticsInfoBanner } from '@/components/analytics/AnalyticsInfoBanner';
import { AnalyticsNoticeScreen } from '@/components/analytics/AnalyticsNoticeScreen';
import { AnalyticsPlatformCards } from '@/components/analytics/AnalyticsPlatformCards';
import { analyticsConfigStyles as styles } from '@/components/analytics/analytics-config.styles';
import { OfflineConversionsCard } from '@/components/analytics/OfflineConversionsCard';
import { FeatureGateScreen } from '@/components/billing/FeatureGateScreen';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { isStoreReadinessSetupOrigin } from '@/constants/store-readiness-routes';
import { useAnalyticsConfigForm } from '@/hooks/useAnalyticsConfigForm';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { baciFeatureGates } from '@/lib/feature-gates';

export default function AnalyticsConfigScreen() {
  const { colors, shadows } = useTheme();
  const { user } = useAuth();
  const { merchant: merchantContext } = useMerchant();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const hasGrowthIntegrations = baciFeatureGates.hasFeature(
    merchantContext,
    'growth_integrations'
  );
  const {
    analytics,
    canManageAnalytics,
    handleSave,
    isError,
    isLoading,
    isSavePending,
    refetch,
    trackingConfig,
    updateField,
  } = useAnalyticsConfigForm({
    hasGrowthIntegrations,
    isSetupOrigin: isStoreReadinessSetupOrigin(from),
    merchantId: merchantContext?.id,
    onBack: () => router.back(),
    userId: user?.id,
  });

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScreenSkeleton variant="card-list" cards={4} />
      </SafeAreaView>
    );
  }

  if (isError && !trackingConfig) {
    return (
      <AnalyticsNoticeScreen
        icon="cloud-offline-outline"
        title="Couldn't load analytics settings"
        message="Check your connection and try again."
        action={{ label: 'Retry', onPress: () => refetch() }}
      />
    );
  }

  if (trackingConfig && !canManageAnalytics) {
    return (
      <AnalyticsNoticeScreen
        icon="lock-closed-outline"
        title="Owner-only settings"
        message="Analytics credentials can only be viewed and managed by the store owner."
      />
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Analytics & Tracking',
          headerRight:
            hasGrowthIntegrations && canManageAnalytics
              ? () => (
                  <Pressable
                    onPress={handleSave}
                    disabled={isSavePending}
                    style={styles.saveButton}
                  >
                    {isSavePending ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text
                        style={[styles.saveText, { color: colors.primary }]}
                      >
                        Save
                      </Text>
                    )}
                  </Pressable>
                )
              : undefined,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
        }}
      />
      <FeatureGateScreen
        description="Enable advanced pixels, conversion APIs, and offline conversion tracking when Baci Pro is active."
        feature="growth_integrations"
        serverEntitlementRequired
        title="Growth integrations are a Baci Pro feature"
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['bottom']}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <AnalyticsInfoBanner colors={colors} />
            <AnalyticsPlatformCards
              analytics={analytics}
              colors={colors}
              expandedSection={expandedSection}
              onToggleSection={(section) =>
                setExpandedSection((current) =>
                  current === section ? null : section
                )
              }
              shadows={shadows}
              updateField={updateField}
            />
            <OfflineConversionsCard
              colors={colors}
              enabled={analytics.offline_conversions_enabled}
              onChange={updateField}
              shadows={shadows}
            />
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </FeatureGateScreen>
    </>
  );
}
