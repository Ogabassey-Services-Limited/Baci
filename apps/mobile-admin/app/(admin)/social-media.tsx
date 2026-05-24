import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SocialMediaInput from '@/components/settings/SocialMediaInput';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { type MerchantSocialMedia, useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { updateMerchantSettings } from '@/lib/merchant-settings';

const EMPTY_SOCIAL_MEDIA: MerchantSocialMedia = {
  instagram: '',
  twitter: '',
  facebook: '',
  tiktok: '',
  youtube: '',
  pinterest: '',
  linkedin: '',
  snapchat: '',
};

type SocialMediaFieldConfig = {
  platform: keyof MerchantSocialMedia;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  placeholder: string;
  badge?: string;
};

const SOCIAL_MEDIA_FIELDS: readonly SocialMediaFieldConfig[] = [
  {
    platform: 'instagram',
    label: 'Instagram Handle',
    icon: 'logo-instagram',
    placeholder: '@username',
  },
  {
    platform: 'twitter',
    label: 'Twitter/X Handle',
    icon: 'logo-twitter',
    placeholder: '@username',
  },
  {
    platform: 'snapchat',
    label: 'Snapchat Handle',
    icon: 'logo-snapchat',
    placeholder: '@username',
    badge: 'NEW',
  },
  {
    platform: 'facebook',
    label: 'Facebook URL',
    icon: 'logo-facebook',
    placeholder: 'https://facebook.com/page',
  },
  {
    platform: 'youtube',
    label: 'YouTube URL',
    icon: 'logo-youtube',
    placeholder: 'https://youtube.com/@channel',
  },
  {
    platform: 'pinterest',
    label: 'Pinterest URL',
    icon: 'logo-pinterest',
    placeholder: 'https://pinterest.com/profile',
  },
  {
    platform: 'tiktok',
    label: 'TikTok Handle',
    icon: 'logo-tiktok',
    placeholder: '@username',
  },
  {
    platform: 'linkedin',
    label: 'LinkedIn URL',
    icon: 'logo-linkedin',
    placeholder: 'https://linkedin.com/company/...',
  },
] as const;

export default function SocialMediaScreen() {
  const { colors, shadows } = useTheme();
  const { merchant, isLoading } = useMerchant();
  const router = useRouter();
  const queryClient = useQueryClient();

  // State for social media
  const [socialMedia, setSocialMedia] =
    useState<MerchantSocialMedia>(EMPTY_SOCIAL_MEDIA);
  const instagram = merchant?.social_media?.instagram ?? '';
  const twitter = merchant?.social_media?.twitter ?? '';
  const facebook = merchant?.social_media?.facebook ?? '';
  const tiktok = merchant?.social_media?.tiktok ?? '';
  const youtube = merchant?.social_media?.youtube ?? '';
  const pinterest = merchant?.social_media?.pinterest ?? '';
  const linkedin = merchant?.social_media?.linkedin ?? '';
  const snapchat = merchant?.social_media?.snapchat ?? '';

  // Populate state
  useEffect(() => {
    setSocialMedia({
      ...EMPTY_SOCIAL_MEDIA,
      instagram,
      twitter,
      facebook,
      tiktok,
      youtube,
      pinterest,
      linkedin,
      snapchat,
    });
  }, [
    instagram,
    twitter,
    facebook,
    tiktok,
    youtube,
    pinterest,
    linkedin,
    snapchat,
  ]);

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
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScreenSkeleton variant="settings" cards={4} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Social Media',
          /* Native back button */
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
          // headerBackTitleVisible: false,
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
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
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
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
