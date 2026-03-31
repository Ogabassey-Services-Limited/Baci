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
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '@/components/ui/Toast';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { queryClient } from '@/lib/query-client';
import { type AppearanceMode, useSettingsStore } from '@/stores/settings-store';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const APPEARANCE_OPTIONS: {
  value: AppearanceMode;
  label: string;
  icon: IoniconsName;
}[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

const PRIVACY_URL = 'https://ogabassey.com/privacy';
const TERMS_URL = 'https://ogabassey.com/terms';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const toast = useToast();

  const appearance = useSettingsStore((s) => s.appearance);
  const setAppearance = useSettingsStore((s) => s.setAppearance);

  const {
    isRegistered,
    isLoading: isPushLoading,
    register: registerPush,
    unregister: unregisterPush,
  } = usePushNotifications();

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // expo-haptics supports both iOS and Android
  const haptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
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
        await registerPush();
      } else {
        await unregisterPush();
      }
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
                await AsyncStorage.multiRemove(cacheKeys);
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

  return (
    <>
      <Stack.Screen options={{ title: 'App Settings' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* APPEARANCE */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              APPEARANCE
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
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
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`${option.label} appearance mode`}
                    >
                      <Ionicons
                        name={option.icon}
                        size={18}
                        color={
                          isActive
                            ? colors.primaryForeground
                            : colors.textSecondary
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
            </View>
          </Animated.View>

          {/* NOTIFICATIONS */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              NOTIFICATIONS
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: `${BRAND.primary}15` },
                    ]}
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={20}
                      color={BRAND.primary}
                    />
                  </View>
                  <View>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>
                      Push Notifications
                    </Text>
                    <Text
                      style={[styles.rowSub, { color: colors.textSecondary }]}
                    >
                      Order updates, deals, and alerts
                    </Text>
                  </View>
                </View>
                {isPushLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Switch
                    value={isRegistered}
                    onValueChange={(val) => {
                      void handleNotificationToggle(val);
                    }}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary,
                    }}
                    accessibilityLabel="Toggle push notifications"
                  />
                )}
              </View>
            </View>
          </Animated.View>

          {/* ABOUT */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              ABOUT
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.row,
                  styles.rowBorder,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View style={styles.rowLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: `${colors.textSecondary}15` },
                    ]}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    App Version
                  </Text>
                </View>
                <Text
                  style={[styles.rowValue, { color: colors.textSecondary }]}
                >
                  {appVersion}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  void openLink(PRIVACY_URL);
                }}
                style={[
                  styles.row,
                  styles.rowBorder,
                  { borderBottomColor: colors.border },
                ]}
                accessibilityRole="link"
                accessibilityLabel="Open privacy policy"
              >
                <View style={styles.rowLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: `${colors.textSecondary}15` },
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    Privacy Policy
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  void openLink(TERMS_URL);
                }}
                style={styles.row}
                accessibilityRole="link"
                accessibilityLabel="Open terms of service"
              >
                <View style={styles.rowLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: `${colors.textSecondary}15` },
                    ]}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    Terms of Service
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          </Animated.View>

          {/* DATA */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              DATA
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Pressable
                onPress={handleClearCache}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel="Clear cached data"
              >
                <View style={styles.rowLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: `${colors.error}15` },
                    ]}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={colors.error}
                    />
                  </View>
                  <View>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>
                      Clear Cache
                    </Text>
                    <Text
                      style={[styles.rowSub, { color: colors.textSecondary }]}
                    >
                      Remove cached images and data
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>

        <SafeAreaView edges={['bottom']}>
          <Text style={[styles.footer, { color: colors.textSecondary }]}>
            {BRAND.name} v{appVersion}
          </Text>
        </SafeAreaView>
        <toast.Toast />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  card: {
    borderRadius: RADIUS['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: SPACING.xs,
    gap: SPACING.xs,
  },
  segmentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + SPACING.xs,
    borderRadius: RADIUS.xl,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    opacity: 0.4,
    paddingBottom: SPACING.sm,
  },
});
