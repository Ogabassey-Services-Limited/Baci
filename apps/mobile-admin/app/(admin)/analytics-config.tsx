import Ionicons, {
  type IoniconsIconName,
} from '@react-native-vector-icons/ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalyticsNoticeScreen } from '@/components/analytics/AnalyticsNoticeScreen';
import { FeatureGateScreen } from '@/components/billing/FeatureGateScreen';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { isStoreReadinessSetupOrigin } from '@/constants/store-readiness-routes';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAnalyticsConfigForm } from '@/hooks/useAnalyticsConfigForm';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import type { AnalyticsState } from '@/lib/analytics-config-diff';
import { baciFeatureGates } from '@/lib/feature-gates';

// Help links for each platform
const HELP_LINKS = {
  facebook: 'https://www.facebook.com/business/help/952192354843755',
  tiktok: 'https://ads.tiktok.com/help/article/events-api',
  google: 'https://support.google.com/analytics/answer/9304153',
  snapchat: 'https://businesshelp.snapchat.com/s/article/conversions-api',
};

type Theme = ReturnType<typeof useTheme>;

const openHelpLink = (platform: keyof typeof HELP_LINKS) => {
  Linking.openURL(HELP_LINKS[platform]);
};

// Input field for a single analytics credential. Defined at module scope so
// React does not recreate it (losing TextInput state) on every parent render.
const InputField = ({
  label,
  value,
  field,
  placeholder,
  icon,
  secureTextEntry = false,
  colors,
  onUpdateField,
}: {
  label: string;
  value: string;
  field: keyof AnalyticsState;
  placeholder: string;
  icon: IoniconsIconName;
  secureTextEntry?: boolean;
  colors: Theme['colors'];
  onUpdateField: (field: keyof AnalyticsState, value: string) => void;
}) => (
  <View style={styles.inputGroup}>
    <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    <View
      style={[
        styles.inputContainer,
        {
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        value={value}
        onChangeText={(t) => onUpdateField(field, t)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  </View>
);

// Collapsible platform configuration card. Defined at module scope so React
// does not recreate it (resetting its subtree) on every parent render.
const PlatformCard = ({
  title,
  icon,
  iconColor,
  isExpanded,
  onToggle,
  helpKey,
  children,
  isConfigured,
  colors,
  shadows,
}: {
  title: string;
  icon: IoniconsIconName;
  iconColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  helpKey: keyof typeof HELP_LINKS;
  children: React.ReactNode;
  isConfigured: boolean;
  colors: Theme['colors'];
  shadows: Theme['shadows'];
}) => (
  <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
    <Pressable style={styles.cardHeader} onPress={onToggle}>
      <View style={styles.cardTitleRow}>
        <View style={[styles.iconBadge, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {title}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isConfigured ? '#22c55e' : colors.textMuted,
                },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {isConfigured ? 'Configured' : 'Not configured'}
            </Text>
          </View>
        </View>
      </View>
      <Ionicons
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={colors.textMuted}
      />
    </Pressable>

    {isExpanded && (
      <View style={styles.cardContent}>
        <Pressable
          style={styles.helpLink}
          onPress={() => openHelpLink(helpKey)}
        >
          <Ionicons
            name="help-circle-outline"
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.helpText, { color: colors.primary }]}>
            How to get your {title} credentials
          </Text>
        </Pressable>
        {children}
      </View>
    )}
  </View>
);

export default function AnalyticsConfigScreen() {
  const { colors, shadows } = useTheme();
  const { user } = useAuth();
  const { merchant: merchantContext } = useMerchant();
  const merchantId = merchantContext?.id;
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const hasGrowthIntegrations = baciFeatureGates.hasFeature(
    merchantContext,
    'growth_integrations'
  );
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
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
    merchantId,
    onBack: () => router.back(),
    userId: user?.id,
  });

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScreenSkeleton variant="card-list" cards={4} />
      </SafeAreaView>
    );
  }

  // A failed context load leaves trackingConfig undefined, which the owner
  // gate below would read as "not the owner" and silently strip Save from a
  // legitimate owner. Surface the failure with a retry instead.
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

  // Staff receive redacted tokens from the context RPC and the owner-filtered
  // save UPDATE would match zero rows for them, so the editable form (and its
  // false success path) is owner-only.
  if (trackingConfig && !canManageAnalytics) {
    return (
      <AnalyticsNoticeScreen
        icon="lock-closed-outline"
        title="Owner-only settings"
        message="Analytics credentials can only be viewed and managed by the store owner."
      />
    );
  }

  // Check if platforms are configured
  const isFacebookConfigured = !!(
    analytics.facebook_pixel_id && analytics.facebook_capi_token
  );
  const isTikTokConfigured = !!(
    analytics.tiktok_pixel_id && analytics.tiktok_access_token
  );
  const isGoogleConfigured = !!(
    analytics.google_analytics_id && analytics.ga4_api_secret
  );
  const isSnapchatConfigured = !!(
    analytics.snapchat_pixel_id && analytics.snapchat_capi_token
  );

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
            {/* Info Banner */}
            <View
              style={[
                styles.infoBanner,
                { backgroundColor: `${colors.primary}10` },
              ]}
            >
              <Ionicons
                name="rocket-outline"
                size={24}
                color={colors.primary}
              />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>
                  Server-Side Tracking
                </Text>
                <Text
                  style={[styles.infoText, { color: colors.textSecondary }]}
                >
                  Configure CAPI tokens to track conversions even when customers
                  use ad blockers. Your orders will be automatically reported to
                  ad platforms.
                </Text>
              </View>
            </View>

            {/* Meta/Facebook */}
            <PlatformCard
              title="Meta (Facebook/Instagram)"
              icon="logo-facebook"
              iconColor="#1877F2"
              isExpanded={expandedSection === 'facebook'}
              onToggle={() => toggleSection('facebook')}
              helpKey="facebook"
              isConfigured={isFacebookConfigured}
              colors={colors}
              shadows={shadows}
            >
              <InputField
                label="Pixel ID"
                value={analytics.facebook_pixel_id}
                field="facebook_pixel_id"
                placeholder="1234567890123456"
                icon="code-outline"
                colors={colors}
                onUpdateField={updateField}
              />
              <InputField
                label="Conversions API Token"
                value={analytics.facebook_capi_token}
                field="facebook_capi_token"
                placeholder="EAAxxxxxxxx..."
                icon="key-outline"
                secureTextEntry
                colors={colors}
                onUpdateField={updateField}
              />
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Get your token from Events Manager → Settings → Generate Access
                Token
              </Text>
            </PlatformCard>

            {/* TikTok */}
            <PlatformCard
              title="TikTok"
              icon="logo-tiktok"
              iconColor={colors.text}
              isExpanded={expandedSection === 'tiktok'}
              onToggle={() => toggleSection('tiktok')}
              helpKey="tiktok"
              isConfigured={isTikTokConfigured}
              colors={colors}
              shadows={shadows}
            >
              <InputField
                label="Pixel ID"
                value={analytics.tiktok_pixel_id}
                field="tiktok_pixel_id"
                placeholder="CXXXXXXXXXXXXXXXXX"
                icon="code-outline"
                colors={colors}
                onUpdateField={updateField}
              />
              <InputField
                label="Events API Access Token"
                value={analytics.tiktok_access_token}
                field="tiktok_access_token"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx"
                icon="key-outline"
                secureTextEntry
                colors={colors}
                onUpdateField={updateField}
              />
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Get your token from TikTok Ads Manager → Assets → Events → Web
                Events → Settings
              </Text>
            </PlatformCard>

            {/* Google Analytics */}
            <PlatformCard
              title="Google Analytics 4 & Ads"
              icon="logo-google"
              iconColor="#EA4335"
              isExpanded={expandedSection === 'google'}
              onToggle={() => toggleSection('google')}
              helpKey="google"
              isConfigured={isGoogleConfigured}
              colors={colors}
              shadows={shadows}
            >
              <InputField
                label="Measurement ID"
                value={analytics.google_analytics_id}
                field="google_analytics_id"
                placeholder="G-XXXXXXXXXX"
                icon="analytics-outline"
                colors={colors}
                onUpdateField={updateField}
              />
              <InputField
                label="API Secret"
                value={analytics.ga4_api_secret}
                field="ga4_api_secret"
                placeholder="xXxXxXxXxXxX"
                icon="key-outline"
                secureTextEntry
                colors={colors}
                onUpdateField={updateField}
              />
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Data sent here syncs to Google Ads if accounts are linked. Get
                API secret from GA4 → Admin → Data Streams.
              </Text>
            </PlatformCard>

            {/* Snapchat */}
            <PlatformCard
              title="Snapchat"
              icon="logo-snapchat"
              iconColor="#FFFC00"
              isExpanded={expandedSection === 'snapchat'}
              onToggle={() => toggleSection('snapchat')}
              helpKey="snapchat"
              isConfigured={isSnapchatConfigured}
              colors={colors}
              shadows={shadows}
            >
              <InputField
                label="Pixel ID"
                value={analytics.snapchat_pixel_id}
                field="snapchat_pixel_id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx"
                icon="code-outline"
                colors={colors}
                onUpdateField={updateField}
              />
              <InputField
                label="Conversions API Token"
                value={analytics.snapchat_capi_token}
                field="snapchat_capi_token"
                placeholder="eyJxxxxxxxxx..."
                icon="key-outline"
                secureTextEntry
                colors={colors}
                onUpdateField={updateField}
              />
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Get your token from Snapchat Ads Manager → Events Manager →
                Conversions API
              </Text>
            </PlatformCard>

            {/* Toggle for offline conversions */}
            <View
              style={[
                styles.toggleCard,
                { backgroundColor: colors.card },
                shadows.sm,
              ]}
            >
              <View style={styles.toggleContent}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.toggleTitle, { color: colors.text }]}>
                    Auto-Upload Conversions
                  </Text>
                  <Text
                    style={[
                      styles.toggleSubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Automatically send orders to ad platforms when payments are
                    confirmed
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.toggle,
                    {
                      backgroundColor: analytics.offline_conversions_enabled
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                  onPress={() =>
                    updateField(
                      'offline_conversions_enabled',
                      !analytics.offline_conversions_enabled
                    )
                  }
                >
                  <View
                    testID="offline-conversions-toggle-knob"
                    style={[
                      styles.toggleKnob,
                      {
                        backgroundColor: colors.textOnPrimary,
                        transform: [
                          {
                            translateX: analytics.offline_conversions_enabled
                              ? 20
                              : 2,
                          },
                        ],
                      },
                    ]}
                  />
                </Pressable>
              </View>
            </View>

            {/* Spacer for bottom */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </FeatureGateScreen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  saveButton: {},
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 4,
  },
  infoText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
  },
  card: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  cardContent: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  helpText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textDecorationLine: 'underline',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    height: '100%',
  },
  hint: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontStyle: 'italic',
    marginTop: -4,
  },
  toggleCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  toggleTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 18,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});
