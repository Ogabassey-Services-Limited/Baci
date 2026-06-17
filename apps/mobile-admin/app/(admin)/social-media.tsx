import Ionicons from '@react-native-vector-icons/ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SocialMediaInput from '@/components/settings/SocialMediaInput';
import SocialMediaRetryState from '@/components/settings/SocialMediaRetryState';
import {
  EMPTY_SOCIAL_MEDIA,
  SOCIAL_MEDIA_FIELDS,
} from '@/components/settings/social-media-fields';
import { AppKeyboardContainer } from '@/components/ui/AppKeyboardContainer';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { type MerchantSocialMedia, useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { updateMerchantSettings } from '@/lib/merchant-settings';

export default function SocialMediaScreen() {
  const { colors, shadows } = useTheme();
  const { merchant, isLoading } = useMerchant();
  const router = useRouter();
  const queryClient = useQueryClient();
  const screenOptions = {
    title: 'Social Media',
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTintColor: colors.text,
  };
  // Non-edit states (loading / retry) must explicitly clear headerRight. React
  // Navigation merges Stack.Screen options, so omitting it would leave a stale
  // Save action from a previously-rendered form. (V4 drift guard)
  const guardedScreenOptions = {
    ...screenOptions,
    headerRight: () => null,
  };

  const instagram = merchant?.social_media?.instagram ?? '';
  const twitter = merchant?.social_media?.twitter ?? '';
  const facebook = merchant?.social_media?.facebook ?? '';
  const tiktok = merchant?.social_media?.tiktok ?? '';
  const youtube = merchant?.social_media?.youtube ?? '';
  const pinterest = merchant?.social_media?.pinterest ?? '';
  const linkedin = merchant?.social_media?.linkedin ?? '';
  const snapchat = merchant?.social_media?.snapchat ?? '';
  const merchantSocialMedia = {
    ...EMPTY_SOCIAL_MEDIA,
    instagram,
    twitter,
    facebook,
    tiktok,
    youtube,
    pinterest,
    linkedin,
    snapchat,
  } satisfies MerchantSocialMedia;
  const merchantSocialMediaKey = [
    instagram,
    twitter,
    facebook,
    tiktok,
    youtube,
    pinterest,
    linkedin,
    snapchat,
  ].join('\u0000');

  const [socialMedia, setSocialMedia] =
    useState<MerchantSocialMedia>(merchantSocialMedia);
  const [previousMerchantSocialMediaKey, setPreviousMerchantSocialMediaKey] =
    useState(merchantSocialMediaKey);

  if (merchantSocialMediaKey !== previousMerchantSocialMediaKey) {
    setPreviousMerchantSocialMediaKey(merchantSocialMediaKey);
    setSocialMedia(merchantSocialMedia);
  }

  // Only allow saving when the form actually changed, so a no-op save can't churn the row
  // and (with the no-merchant guard below) a load that produced no merchant data can never
  // blank saved handles. (V4)
  const isDirty = (
    Object.keys(EMPTY_SOCIAL_MEDIA) as (keyof MerchantSocialMedia)[]
  ).some(
    (platform) =>
      (socialMedia[platform] ?? '') !== (merchantSocialMedia[platform] ?? '')
  );

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () =>
      updateMerchantSettings({
        social_media: socialMedia,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      queryClient.invalidateQueries({ queryKey: ['store-readiness'] });
      Alert.alert('Success', 'Social media links updated', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error: unknown) => {
      Alert.alert('Error', (error as Error).message);
    },
  });

  const handleSave = () => {
    if (!merchant || !isDirty) return;
    saveMutation.mutate();
  };

  const handleSocialMediaChange = (
    platform: keyof MerchantSocialMedia,
    value: string
  ) => {
    setSocialMedia((previous) => ({
      ...previous,
      [platform]: value,
    }));
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={guardedScreenOptions} />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <ScreenSkeleton variant="settings" cards={4} />
        </SafeAreaView>
      </>
    );
  }

  // No merchant data to edit (settled with null, or a hard load error that left no
  // cached data): show a retry state instead of an empty form, so Save can never write
  // blank handles over the merchant's saved social_media. A cached merchant with a
  // background-refetch error keeps the form editable (TanStack keeps `data` + `error`),
  // because saving from cached handles is safe. (V4 drift guard)
  if (!merchant) {
    return (
      <>
        <Stack.Screen options={guardedScreenOptions} />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <SocialMediaRetryState
            colors={colors}
            onRetry={() =>
              queryClient.invalidateQueries({ queryKey: ['merchant'] })
            }
          />
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          ...screenOptions,
          /* Native back button */
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={saveMutation.isPending || !isDirty}
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
          // headerBackTitleVisible: false,
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <AppKeyboardContainer
          align="start"
          contentContainerStyle={styles.scrollContent}
          offsetPreset="compactHeader"
        >
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="share-social"
                size={24}
                color={colors.primary}
                style={styles.cardIcon}
              />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Social Profiles
              </Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Connect your social accounts to display icons on your storefront
              footer and contact page.
            </Text>
            {SOCIAL_MEDIA_FIELDS.map(
              ({ platform, label, icon, placeholder, badge }) => (
                <SocialMediaInput
                  key={platform}
                  badge={badge}
                  colors={colors}
                  icon={icon}
                  label={label}
                  onChange={(value) => handleSocialMediaChange(platform, value)}
                  placeholder={placeholder}
                  platform={platform}
                  value={socialMedia[platform] ?? ''}
                />
              )
            )}
          </View>
        </AppKeyboardContainer>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  backButton: {}, // Native handles padding
  saveButton: {},
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  cardIcon: {
    marginBottom: 2, // optical alignment
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
});
