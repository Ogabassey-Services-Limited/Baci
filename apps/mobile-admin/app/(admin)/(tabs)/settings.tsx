/**
 * Settings Screen - Store Configuration
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_VERSION_LABEL } from '@/constants/app-info';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTheme } from '@/hooks/useTheme';

export default function SettingsScreen() {
  const { resetOnboarding } = useOnboarding();
  const { signOut } = useAuth();
  const { unregisterPush } = usePushNotifications();
  const { colors } = useTheme();
  const _router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut(unregisterPush);
        },
      },
    ]);
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    showArrow = true,
    toggle,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    showArrow?: boolean;
    toggle?: boolean;
    onPress?: () => void;
  }) => (
    <Pressable
      style={({ pressed }) => [
        styles.settingItem,
        { borderBottomColor: colors.border },
        pressed && onPress && { opacity: 0.7 }
      ]}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
      accessibilityHint={onPress ? subtitle : undefined}
    >
      <View
        style={[styles.settingIcon, { backgroundColor: colors.background }]}
      >
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.settingSubtitle, { color: colors.textSecondary }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {toggle !== undefined ? (
        <Switch
          value={toggle}
          onValueChange={() => {
            // Toggle logic handled by parent
          }}
          trackColor={{ true: colors.primary }}
        />
      ) : showArrow ? (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      ) : null}
    </Pressable>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Store Info */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            STORE
          </Text>
          <SettingItem
            icon="storefront-outline"
            title="Store Profile"
            subtitle="Name, logo, contact info"
          />
          <SettingItem
            icon="time-outline"
            title="Business Hours"
            subtitle="Set operating hours"
          />
          <SettingItem
            icon="location-outline"
            title="Store Locations"
            subtitle="Manage pickup points"
          />
        </View>

        {/* Growth & Marketing */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            GROWTH & MARKETING
          </Text>
          <SettingItem
            icon="bar-chart-outline"
            title="Analytics & Tracking"
            subtitle="Pixels, CAPI, Setup"
            onPress={() => _router.push('/(admin)/analytics-config')}
          />
        </View>

        {/* Notifications */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            NOTIFICATIONS
          </Text>
          <SettingItem
            icon="notifications-outline"
            title="Push Notifications"
            toggle={true}
          />
          <SettingItem icon="mail-outline" title="Email Alerts" toggle={true} />
          <SettingItem
            icon="musical-notes-outline"
            title="Order Sound"
            toggle={false}
          />
        </View>

        {/* Orders */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            ORDERS
          </Text>
          <SettingItem
            icon="print-outline"
            title="Receipt Printer"
            subtitle="Connect thermal printer"
          />
          <SettingItem
            icon="bicycle-outline"
            title="Delivery Settings"
            subtitle="Zones, fees, partners"
          />
          <SettingItem
            icon="pricetag-outline"
            title="Tax Configuration"
            subtitle="VAT and pricing rules"
          />
        </View>

        {/* Account */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            ACCOUNT
          </Text>
          <SettingItem
            icon="people-outline"
            title="Team Members"
            subtitle="Manage staff access"
          />
          <SettingItem
            icon="shield-checkmark-outline"
            title="Security"
            subtitle="Password, 2FA"
          />
          <SettingItem icon="help-circle-outline" title="Help & Support" />
        </View>

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && { opacity: 0.7 }
          ]}
          onPress={handleLogout}
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>
            Sign Out
          </Text>
        </Pressable>

        <Text style={[styles.version, { color: colors.textSecondary }]}>
          {APP_VERSION_LABEL}
        </Text>

        {/* DEV: Reset Onboarding */}
        {__DEV__ && (
          <Pressable
            style={[
              styles.devButton,
              {
                backgroundColor: colors.warningLight,
                borderColor: colors.warning,
              },
            ]}
            onPress={async () => {
              await resetOnboarding();
              Alert.alert(
                'Onboarding Reset',
                'You will now be taken to the onboarding screen.',
                [
                  {
                    text: 'OK',
                    onPress: () => _router.replace('/(auth)/onboarding'),
                  },
                ]
              );
            }}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.warning} />
            <Text style={{ color: colors.warning, fontWeight: '600' }}>
              Reset Onboarding (Dev)
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 16,
  },
});
