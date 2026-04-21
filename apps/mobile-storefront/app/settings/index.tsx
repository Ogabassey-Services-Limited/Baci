import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useToast } from '@/components/ui/Toast';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import { queryClient } from '@/lib/query-client';
import { removeStorageItems } from '@/lib/storage';
import { type AppearanceMode, useSettingsStore } from '@/stores/settings-store';
import { ABOUT_LINKS, APPEARANCE_OPTIONS } from './constants';
import { SettingsCardSection } from './SettingsCardSection';
import { SettingsSectionRow } from './SettingsSectionRow';
import { styles } from './styles';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const toast = useToast();
  const { getScrollContentStyle } = useStorefrontInsets();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const appearance = useSettingsStore((state) => state.appearance);
  const setAppearance = useSettingsStore((state) => state.setAppearance);
  const {
    isRegistered,
    isLoading: isPushLoading,
    register: registerPush,
    unregister: unregisterPush,
  } = usePushNotifications();

  const haptic = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // Ignore unsupported haptics environments.
    });
  };

  const handleAppearanceChange = (mode: AppearanceMode) => {
    haptic();
    setAppearance(mode);
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    haptic();

    try {
      if (enabled) {
        await registerPush(undefined, undefined, { force: true });
        return;
      }

      await unregisterPush();
    } catch {
      toast.error('Failed to update notification settings. Please try again.');
    }
  };

  const handleClearCache = () => {
    haptic();
    Alert.alert(
      'Clear cache?',
      'This will remove cached product data and images. Your account and cart will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              queryClient.clear();

              const allKeys = await AsyncStorage.getAllKeys();
              const cacheKeys = allKeys.filter(
                (key) =>
                  !key.startsWith('supabase') &&
                  key !== 'app-settings-storage' &&
                  key !== 'app-theme-storage' &&
                  key !== 'auth-storage'
              );

              if (cacheKeys.length > 0) {
                await removeStorageItems(cacheKeys);
              }

              toast.success('Cache cleared successfully.');
            } catch {
              toast.error('Failed to clear cache. Please try again.');
            }
          },
        },
      ]
    );
  };

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error('Unable to open link on this device.');
    }
  };

  const scrollContentStyle = getScrollContentStyle({
    includeBottomInset: false,
    paddingBottom: SPACING.xl,
  });

  return (
    <StorefrontScreenShell
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen options={{ title: 'App Settings' }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, scrollContentStyle]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsCardSection
          cardBackgroundColor={colors.card}
          cardBorderColor={colors.border}
          title="APPEARANCE"
          titleColor={colors.textSecondary}
          delay={100}
        >
          <View style={styles.segmentedControl}>
            {APPEARANCE_OPTIONS.map((option) => {
              const isActive = appearance === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleAppearanceChange(option.value)}
                  style={[
                    styles.segmentOption,
                    isActive
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.muted },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={`${option.label} appearance mode`}
                >
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={
                      isActive ? colors.primaryForeground : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.segmentLabel,
                      {
                        color: isActive
                          ? colors.primaryForeground
                          : colors.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SettingsCardSection>

        <SettingsCardSection
          cardBackgroundColor={colors.card}
          cardBorderColor={colors.border}
          title="NOTIFICATIONS"
          titleColor={colors.textSecondary}
          delay={200}
        >
          <SettingsSectionRow
            icon="notifications-outline"
            iconBackgroundColor={`${BRAND.primary}15`}
            iconColor={BRAND.primary}
            label="Push Notifications"
            labelColor={colors.text}
            subtitle="Order updates, deals, and alerts"
            subtitleColor={colors.textSecondary}
            right={
              isPushLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Switch
                  value={isRegistered}
                  onValueChange={(value) => {
                    void handleNotificationToggle(value);
                  }}
                  trackColor={{
                    false: colors.border,
                    true: colors.primary,
                  }}
                  accessibilityLabel="Toggle push notifications"
                />
              )
            }
          />
        </SettingsCardSection>

        <SettingsCardSection
          cardBackgroundColor={colors.card}
          cardBorderColor={colors.border}
          title="ABOUT"
          titleColor={colors.textSecondary}
          delay={300}
        >
          <SettingsSectionRow
            borderBottom
            icon="information-circle-outline"
            iconBackgroundColor={`${colors.textSecondary}15`}
            iconColor={colors.textSecondary}
            label="App Version"
            labelColor={colors.text}
            right={
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                {appVersion}
              </Text>
            }
          />
          {ABOUT_LINKS.map((link, index) => (
            <SettingsSectionRow
              key={link.label}
              borderBottom={index !== ABOUT_LINKS.length - 1}
              accessibilityLabel={link.accessibilityLabel}
              accessibilityRole="link"
              icon={link.icon}
              iconBackgroundColor={`${colors.textSecondary}15`}
              iconColor={colors.textSecondary}
              label={link.label}
              labelColor={colors.text}
              onPress={() => {
                void openLink(link.url);
              }}
              right={
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              }
            />
          ))}
        </SettingsCardSection>

        <SettingsCardSection
          cardBackgroundColor={colors.card}
          cardBorderColor={colors.border}
          title="DATA"
          titleColor={colors.textSecondary}
          delay={400}
        >
          <SettingsSectionRow
            icon="trash-outline"
            iconBackgroundColor={`${colors.error}15`}
            iconColor={colors.error}
            label="Clear Cache"
            labelColor={colors.text}
            subtitle="Remove cached images and data"
            subtitleColor={colors.textSecondary}
            accessibilityLabel="Clear cached data"
            onPress={handleClearCache}
            right={
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textSecondary}
              />
            }
          />
        </SettingsCardSection>

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          {BRAND.name} v{appVersion}
        </Text>
      </ScrollView>

      <toast.Toast />
    </StorefrontScreenShell>
  );
}
