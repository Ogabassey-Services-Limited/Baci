import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

interface NotificationPreferences {
  merchant_id: string;
  in_app_enabled: boolean;
  banner_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export default function NotificationsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { user: _user } = useAuth();
  const { merchant } = useMerchant();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch notification preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', merchant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('merchant_id', merchant?.id)
        .maybeSingle();

      if (error) throw error;

      // If no preferences found, return defaults
      if (!data) {
        return {
          merchant_id: merchant?.id,
          in_app_enabled: true,
          banner_enabled: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
        } as NotificationPreferences;
      }

      return data as NotificationPreferences;
    },
    enabled: !!merchant?.id,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!merchant?.id) throw new Error('Merchant not found');

      const { error } = await supabase.from('notification_preferences').upsert({
        merchant_id: merchant.id,
        ...preferences,
        ...updates,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
    onError: (error: unknown) => {
      Alert.alert(
        'Error',
        (error as Error).message || 'Failed to update preferences'
      );
    },
  });

  const toggleInApp = (value: boolean) => {
    updatePreferencesMutation.mutate({ in_app_enabled: value });
  };

  const toggleBanner = (value: boolean) => {
    updatePreferencesMutation.mutate({ banner_enabled: value });
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.infoSection}>
            <Ionicons
              name="notifications-circle-outline"
              size={64}
              color={colors.primary}
            />
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Notification Preferences
            </Text>
            <Text
              style={[styles.infoSubtitle, { color: colors.textSecondary }]}
            >
              Choose how you want to be notified about your store activities.
            </Text>
          </View>

          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  In-App Notifications
                </Text>
                <Text
                  style={[styles.settingDesc, { color: colors.textSecondary }]}
                >
                  Show alerts within the admin app
                </Text>
              </View>
              <Switch
                value={preferences?.in_app_enabled ?? true}
                onValueChange={toggleInApp}
                trackColor={{
                  false: colors.border,
                  true: `${colors.primary}50`,
                }}
                thumbColor={
                  (preferences?.in_app_enabled ?? true)
                    ? colors.primary
                    : colors.textMuted
                }
              />
            </View>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  Push Notifications
                </Text>
                <Text
                  style={[styles.settingDesc, { color: colors.textSecondary }]}
                >
                  Show banners on your device lock screen
                </Text>
              </View>
              <Switch
                value={preferences?.banner_enabled ?? true}
                onValueChange={toggleBanner}
                trackColor={{
                  false: colors.border,
                  true: `${colors.primary}50`,
                }}
                thumbColor={
                  (preferences?.banner_enabled ?? true)
                    ? colors.primary
                    : colors.textMuted
                }
              />
            </View>
          </View>

          <View style={styles.noteSection}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.textMuted}
            />
            <Text style={[styles.noteText, { color: colors.textMuted }]}>
              System-level notification permissions can be managed in your
              device settings.
            </Text>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.md,
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginTop: SPACING.sm,
  },
  infoSubtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xl,
  },
  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  settingInfo: { flex: 1, marginRight: SPACING.md },
  settingLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  settingDesc: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  divider: { height: 1, marginHorizontal: SPACING.lg },
  noteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  noteText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
});
