/**
 * Analytics & Tracking Configuration Screen
 * Full CAPI support for Facebook, TikTok, Google Analytics, and Snapchat
 * 2026 Best Practice: Complete server-side tracking setup
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

interface AnalyticsState {
  // Google Analytics 4
  google_analytics_id: string;
  ga4_api_secret: string;
  // Facebook/Meta
  facebook_pixel_id: string;
  facebook_capi_token: string;
  // TikTok
  tiktok_pixel_id: string;
  tiktok_access_token: string;
  // Snapchat
  snapchat_pixel_id: string;
  snapchat_capi_token: string;
  // Feature toggle
  offline_conversions_enabled: boolean;
}

const INITIAL_STATE: AnalyticsState = {
  google_analytics_id: '',
  ga4_api_secret: '',
  facebook_pixel_id: '',
  facebook_capi_token: '',
  tiktok_pixel_id: '',
  tiktok_access_token: '',
  snapchat_pixel_id: '',
  snapchat_capi_token: '',
  offline_conversions_enabled: true,
};

// Help links for each platform
const HELP_LINKS = {
  facebook: 'https://www.facebook.com/business/help/952192354843755',
  tiktok: 'https://ads.tiktok.com/help/article/events-api',
  google: 'https://support.google.com/analytics/answer/9304153',
  snapchat: 'https://businesshelp.snapchat.com/s/article/conversions-api',
};

export default function AnalyticsConfigScreen() {
  const { colors, shadows } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [analytics, setAnalytics] = useState<AnalyticsState>(INITIAL_STATE);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Fetch merchant data with all analytics fields
  const { data: merchant, isLoading } = useQuery({
    queryKey: ['merchant-analytics-full', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select(`
          google_analytics_id,
          ga4_api_secret,
          facebook_pixel_id,
          facebook_capi_token,
          tiktok_pixel_id,
          tiktok_access_token,
          snapchat_pixel_id,
          snapchat_capi_token,
          offline_conversions_enabled
        `)
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Populate state
  useEffect(() => {
    if (merchant) {
      setAnalytics({
        google_analytics_id: merchant.google_analytics_id || '',
        ga4_api_secret: merchant.ga4_api_secret || '',
        facebook_pixel_id: merchant.facebook_pixel_id || '',
        facebook_capi_token: merchant.facebook_capi_token || '',
        tiktok_pixel_id: merchant.tiktok_pixel_id || '',
        tiktok_access_token: merchant.tiktok_access_token || '',
        snapchat_pixel_id: merchant.snapchat_pixel_id || '',
        snapchat_capi_token: merchant.snapchat_capi_token || '',
        offline_conversions_enabled:
          merchant.offline_conversions_enabled !== false,
      });
    }
  }, [merchant]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('merchants')
        .update({
          google_analytics_id: analytics.google_analytics_id || null,
          ga4_api_secret: analytics.ga4_api_secret || null,
          facebook_pixel_id: analytics.facebook_pixel_id || null,
          facebook_capi_token: analytics.facebook_capi_token || null,
          tiktok_pixel_id: analytics.tiktok_pixel_id || null,
          tiktok_access_token: analytics.tiktok_access_token || null,
          snapchat_pixel_id: analytics.snapchat_pixel_id || null,
          snapchat_capi_token: analytics.snapchat_capi_token || null,
          offline_conversions_enabled: analytics.offline_conversions_enabled,
        })
        .eq('user_id', user?.id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-analytics-full'] });
      queryClient.invalidateQueries({ queryKey: ['store-readiness'] });
      Alert.alert('Success', 'Analytics settings saved!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const updateField = (
    field: keyof AnalyticsState,
    value: string | boolean
  ) => {
    setAnalytics((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const openHelpLink = (platform: keyof typeof HELP_LINKS) => {
    Linking.openURL(HELP_LINKS[platform]);
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

  // Helper component for input fields
  const InputField = ({
    label,
    value,
    field,
    placeholder,
    icon,
    secureTextEntry = false,
  }: {
    label: string;
    value: string;
    field: keyof AnalyticsState;
    placeholder: string;
    icon: keyof typeof Ionicons.glyphMap;
    secureTextEntry?: boolean;
  }) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
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
          onChangeText={(t) => updateField(field, t)}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );

  // Platform card component
  const PlatformCard = ({
    title,
    icon,
    iconColor,
    isExpanded,
    onToggle,
    helpKey,
    children,
    isConfigured,
  }: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    isExpanded: boolean;
    onToggle: () => void;
    helpKey: keyof typeof HELP_LINKS;
    children: React.ReactNode;
    isConfigured: boolean;
  }) => (
    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
      <Pressable style={styles.cardHeader} onPress={onToggle}>
        <View style={styles.cardTitleRow}>
          <View
            style={[styles.iconBadge, { backgroundColor: `${iconColor}15` }]}
          >
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
                    backgroundColor: isConfigured
                      ? '#22c55e'
                      : colors.textMuted,
                  },
                ]}
              />
              <Text
                style={[styles.statusText, { color: colors.textSecondary }]}
              >
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
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={saveMutation.isPending}
              style={styles.saveButton}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveText, { color: colors.primary }]}>
                  Save
                </Text>
              )}
            </Pressable>
          ),
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
        }}
      />
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
            <Ionicons name="rocket-outline" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>
                Server-Side Tracking
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
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
          >
            <InputField
              label="Pixel ID"
              value={analytics.facebook_pixel_id}
              field="facebook_pixel_id"
              placeholder="1234567890123456"
              icon="code-outline"
            />
            <InputField
              label="Conversions API Token"
              value={analytics.facebook_capi_token}
              field="facebook_capi_token"
              placeholder="EAAxxxxxxxx..."
              icon="key-outline"
              secureTextEntry
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
          >
            <InputField
              label="Pixel ID"
              value={analytics.tiktok_pixel_id}
              field="tiktok_pixel_id"
              placeholder="CXXXXXXXXXXXXXXXXX"
              icon="code-outline"
            />
            <InputField
              label="Events API Access Token"
              value={analytics.tiktok_access_token}
              field="tiktok_access_token"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx"
              icon="key-outline"
              secureTextEntry
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
          >
            <InputField
              label="Measurement ID"
              value={analytics.google_analytics_id}
              field="google_analytics_id"
              placeholder="G-XXXXXXXXXX"
              icon="analytics-outline"
            />
            <InputField
              label="API Secret"
              value={analytics.ga4_api_secret}
              field="ga4_api_secret"
              placeholder="xXxXxXxXxXxX"
              icon="key-outline"
              secureTextEntry
            />
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Data sent here syncs to Google Ads if accounts are linked. Get API
              secret from GA4 → Admin → Data Streams.
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
          >
            <InputField
              label="Pixel ID"
              value={analytics.snapchat_pixel_id}
              field="snapchat_pixel_id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx"
              icon="code-outline"
            />
            <InputField
              label="Conversions API Token"
              value={analytics.snapchat_capi_token}
              field="snapchat_capi_token"
              placeholder="eyJxxxxxxxxx..."
              icon="key-outline"
              secureTextEntry
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
