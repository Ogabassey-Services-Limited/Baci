/**
 * Social Media Settings Screen
 * Manage social media links for the store
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function SocialMediaScreen() {
  const { colors, shadows } = useTheme();
  const { merchant, isLoading } = useMerchant();
  const router = useRouter();
  const queryClient = useQueryClient();

  // State for social media
  const [socialMedia, setSocialMedia] =
    useState<MerchantSocialMedia>(EMPTY_SOCIAL_MEDIA);

  // Populate state
  useEffect(() => {
    const sm = merchant?.social_media;
    setSocialMedia({
      ...EMPTY_SOCIAL_MEDIA,
      instagram: sm?.instagram || '',
      twitter: sm?.twitter || '',
      facebook: sm?.facebook || '',
      tiktok: sm?.tiktok || '',
      youtube: sm?.youtube || '',
      pinterest: sm?.pinterest || '',
      linkedin: sm?.linkedin || '',
      snapchat: sm?.snapchat || '',
    });
  }, [merchant?.social_media]);

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

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
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

            {/* Instagram */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Instagram Handle
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
                <Ionicons
                  name="logo-instagram"
                  size={20}
                  color={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={socialMedia.instagram}
                  onChangeText={(t) =>
                    setSocialMedia((previous: MerchantSocialMedia) => ({
                      ...previous,
                      instagram: t,
                    }))
                  }
                  placeholder="@username"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Twitter */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Twitter/X Handle
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
                <Ionicons
                  name="logo-twitter"
                  size={20}
                  color={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={socialMedia.twitter}
                  onChangeText={(t) =>
                    setSocialMedia((previous: MerchantSocialMedia) => ({
                      ...previous,
                      twitter: t,
                    }))
                  }
                  placeholder="@username"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Snapchat */}
            <View style={styles.inputGroup}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Snapchat Handle
                </Text>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 4,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}
                  >
                    NEW
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Ionicons
                  name="logo-snapchat"
                  size={20}
                  color={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={socialMedia.snapchat}
                  onChangeText={(t) =>
                    setSocialMedia((previous: MerchantSocialMedia) => ({
                      ...previous,
                      snapchat: t,
                    }))
                  }
                  placeholder="@username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Facebook */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Facebook URL
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
                <Ionicons
                  name="logo-facebook"
                  size={20}
                  color={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={socialMedia.facebook}
                  onChangeText={(t) =>
                    setSocialMedia((previous: MerchantSocialMedia) => ({
                      ...previous,
                      facebook: t,
                    }))
                  }
                  placeholder="https://facebook.com/page"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* TikTok */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                TikTok Handle
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
                <Ionicons
                  name="logo-tiktok"
                  size={20}
                  color={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={socialMedia.tiktok}
                  onChangeText={(t) =>
                    setSocialMedia((previous: MerchantSocialMedia) => ({
                      ...previous,
                      tiktok: t,
                    }))
                  }
                  placeholder="@username"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* LinkedIn */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                LinkedIn URL
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
                <Ionicons
                  name="logo-linkedin"
                  size={20}
                  color={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={socialMedia.linkedin}
                  onChangeText={(t) =>
                    setSocialMedia((previous: MerchantSocialMedia) => ({
                      ...previous,
                      linkedin: t,
                    }))
                  }
                  placeholder="https://linkedin.com/company/..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
              </View>
            </View>
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
  inputGroup: {
    marginBottom: SPACING.lg,
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
});
