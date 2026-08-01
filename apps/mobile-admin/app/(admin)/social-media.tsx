import Ionicons from '@react-native-vector-icons/ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
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
import { AppKeyboardContainer } from '@/components/ui/AppKeyboardContainer';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import {
  EMPTY_SOCIAL_MEDIA,
  SOCIAL_MEDIA_FIELDS,
} from '@/constants/social-media-fields';
import { isStoreReadinessSetupOrigin } from '@/constants/store-readiness-routes';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { type MerchantSocialMedia, useMerchant } from '@/hooks/useMerchant';
import { useMerchantScopedPending } from '@/hooks/useMerchantScopedPending';
import { useTheme } from '@/hooks/useTheme';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import { updateMerchantSettings } from '@/lib/merchant-settings';
import { tryRefreshStoreReadiness } from '@/lib/try-refresh-store-readiness';

export default function SocialMediaScreen() {
  const { colors, shadows } = useTheme();
  const { merchant, isLoading } = useMerchant();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const queryClient = useQueryClient();
  const savePending = useMerchantScopedPending();
  const activeMerchantIdRef = useRef(merchant?.id);
  useLayoutEffect(() => {
    activeMerchantIdRef.current = merchant?.id;
  }, [merchant?.id]);
  const screenOptions = {
    title: 'Social Media',
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTintColor: colors.text,
  };
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
    merchant?.id ?? '',
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

  // Save is disabled until at least one social-media value differs from the
  // merchant's persisted values, preventing a no-op settings write.
  const isDirty = (
    Object.keys(EMPTY_SOCIAL_MEDIA) as (keyof MerchantSocialMedia)[]
  ).some(
    (platform) =>
      (socialMedia[platform] ?? '') !== (merchantSocialMedia[platform] ?? '')
  );

  const saveMutation = useMutation({
    mutationFn: async ({
      merchantId,
      values,
    }: {
      merchantId: string;
      values: MerchantSocialMedia;
    }) => updateMerchantSettings(merchantId, { social_media: values }),
    onMutate: ({ merchantId }) => {
      savePending.begin(merchantId);
      return merchantId;
    },
    onSuccess: async (_data, _variables, savedMerchantId) => {
      const invalidations: Promise<unknown>[] = [
        queryClient.invalidateQueries({ queryKey: ['merchant'] }),
      ];
      if (savedMerchantId) {
        invalidations.push(
          tryRefreshStoreReadiness(() =>
            invalidateStoreReadiness(queryClient, savedMerchantId)
          )
        );
      }
      await Promise.allSettled(invalidations);
      if (savedMerchantId && activeMerchantIdRef.current !== savedMerchantId) {
        return;
      }
      if (isStoreReadinessSetupOrigin(from)) {
        router.back();
        return;
      }
      Alert.alert('Success', 'Social media links updated', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error: unknown, _variables, savedMerchantId) => {
      if (savedMerchantId && activeMerchantIdRef.current !== savedMerchantId) {
        return;
      }
      Alert.alert('Error', (error as Error).message);
    },
    onSettled: (_data, _error, _variables, savedMerchantId) => {
      savePending.end(savedMerchantId ?? null);
    },
  });

  const handleSave = () => {
    if (!merchant || !isDirty) return;
    saveMutation.mutate({ merchantId: merchant.id, values: socialMedia });
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
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={savePending.isPending(merchant.id) || !isDirty}
              style={styles.saveButton}
            >
              {savePending.isPending(merchant.id) ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveText, { color: colors.primary }]}>
                  Save
                </Text>
              )}
            </Pressable>
          ),
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
