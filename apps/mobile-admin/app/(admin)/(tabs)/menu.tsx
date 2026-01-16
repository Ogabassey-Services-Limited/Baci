/**
 * Menu Screen - Settings and More Options
 * Access to settings, support, and additional features
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

interface MenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
  iconColor?: string;
  badge?: string;
  destructive?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function MenuScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { signOut } = useAuth();
  const { merchant, storeUrl, isLive } = useMerchant();
  const { resetOnboarding } = useOnboarding();
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const menuSections: MenuSection[] = [
    {
      title: 'Store',
      items: [
        {
          id: 'customize',
          icon: 'color-palette-outline',
          label: 'Customize Website',
          description: 'Colors, theme, and branding',
          onPress: () => router.push('/customize'),
        },
        {
          id: 'store-settings',
          icon: 'storefront-outline',
          label: 'Store Settings',
          description: 'Name, logo, and store details',
          onPress: () => router.push('/store-settings'),
        },
        {
          id: 'social-media',
          icon: 'share-social-outline',
          label: 'Social Media',
          description: 'Instagram, TikTok, WhatsApp',
          onPress: () => router.push('/social-media'),
        },
        {
          id: 'payments',
          icon: 'card-outline',
          label: 'Payment Methods',
          description: 'Configure payment options',
          onPress: () => router.push('/payment-methods'),
        },
        {
          id: 'shipping',
          icon: 'car-outline',
          label: 'Shipping',
          description: 'Delivery zones and rates',
          onPress: () => router.push('/shipping'),
        },
        {
          id: 'tax',
          icon: 'receipt-outline',
          label: 'Tax',
          description: 'VAT settings',
          onPress: () => router.push('/tax'),
        },
        {
          id: 'domains',
          icon: 'globe-outline',
          label: 'Domains',
          description: 'Custom domain settings',
          onPress: () => router.push('/domains'),
          badge: 'PRO',
        },
      ],
    },
    {
      title: 'Business',
      items: [
        {
          id: 'analytics',
          icon: 'analytics-outline',
          label: 'Analytics',
          description: 'Sales and traffic insights',
          onPress: () => router.push('/analytics'),
        },
        {
          id: 'growth-marketing',
          icon: 'rocket-outline',
          label: 'Growth & Marketing',
          description: 'Pixels, CAPI, Setup',
          onPress: () => router.push('/analytics-config'),
        },
        {
          id: 'expenses',
          icon: 'wallet-outline',
          label: 'Expenses',
          description: 'Track spending and receipts',
          onPress: () => router.push('/expenses'),
        },
        {
          id: 'discounts',
          icon: 'pricetag-outline',
          label: 'Discounts',
          description: 'Coupons and promotions',
          onPress: () => router.push('/discounts'),
        },
        {
          id: 'staff',
          icon: 'people-outline',
          label: 'Staff',
          description: 'Team members and permissions',
          onPress: () => router.push('/staff'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          icon: 'help-circle-outline',
          label: 'Help Center',
          onPress: () => router.push('/help'),
        },
        {
          id: 'contact',
          icon: 'chatbubble-outline',
          label: 'Contact Support',
          onPress: () => router.push('/contact-support'),
        },
        {
          id: 'feedback',
          icon: 'star-outline',
          label: 'Send Feedback',
          onPress: () => router.push('/send-feedback'),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          id: 'profile',
          icon: 'person-outline',
          label: 'Profile',
          description: 'Your account details',
          onPress: () => router.push('/profile'),
        },
        {
          id: 'notifications',
          icon: 'notifications-outline',
          label: 'Notifications',
          description: 'Push notification settings',
          onPress: () => router.push('/notifications'),
        },
        {
          id: 'logout',
          icon: 'log-out-outline',
          label: 'Log Out',
          onPress: handleLogout,
          iconColor: colors.error,
          destructive: true,
        },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItem) => (
    <Pressable
      key={item.id}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={item.onPress}
    >
      <View
        style={[
          styles.menuIcon,
          { backgroundColor: (item.iconColor || colors.primary) + '20' },
        ]}
      >
        <Ionicons
          name={item.icon}
          size={20}
          color={item.iconColor || colors.primary}
        />
      </View>

      <View style={styles.menuContent}>
        <View style={styles.menuLabelRow}>
          <Text
            style={[
              styles.menuLabel,
              { color: item.destructive ? colors.error : colors.text },
            ]}
          >
            {item.label}
          </Text>
          {item.badge && (
            <View style={[styles.badge, { backgroundColor: colors.goldLight }]}>
              <Text style={[styles.badgeText, { color: colors.gold }]}>
                {item.badge}
              </Text>
            </View>
          )}
        </View>
        {item.description && (
          <Text
            style={[styles.menuDescription, { color: colors.textSecondary }]}
          >
            {item.description}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Menu</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Store Preview Card */}
        <Pressable
          style={[
            styles.storeCard,
            { backgroundColor: colors.card },
            shadows.sm,
          ]}
        >
          <View
            style={[styles.storeAvatar, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.storeAvatarText}>
              {merchant?.business_name?.charAt(0).toUpperCase() || 'B'}
            </Text>
          </View>
          <View style={styles.storeInfo}>
            <Text style={[styles.storeName, { color: colors.text }]}>
              {merchant?.business_name || 'Your Store'}
            </Text>
            <Text style={[styles.storeUrl, { color: colors.textSecondary }]}>
              {storeUrl || 'mybaci.store'}
            </Text>
          </View>
          {isLive && (
            <View
              style={[
                styles.liveBadge,
                { backgroundColor: colors.successLight },
              ]}
            >
              <View
                style={[styles.liveDot, { backgroundColor: colors.success }]}
              />
              <Text style={[styles.liveText, { color: colors.success }]}>
                Live
              </Text>
            </View>
          )}
        </Pressable>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              {section.title}
            </Text>
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: colors.card },
                shadows.sm,
              ]}
            >
              {section.items.map((item, index) => (
                <React.Fragment key={item.id}>
                  {renderMenuItem(item)}
                  {index < section.items.length - 1 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* App Version */}
        <Text style={[styles.version, { color: colors.textMuted }]}>
          Baci Admin v1.0.0
        </Text>

        {/* DEV: Reset Onboarding */}
        {__DEV__ && (
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              borderRadius: RADIUS.lg,
              borderWidth: 1,
              gap: 8,
              marginTop: SPACING.md,
              marginBottom: SPACING['3xl'],
              backgroundColor: '#FEF3C7',
              borderColor: '#F59E0B',
            }}
            onPress={async () => {
              await resetOnboarding();
            }}
          >
            <Ionicons name="refresh-outline" size={20} color="#D97706" />
            <Text style={{ color: '#D97706', fontWeight: '600' }}>
              Reset Onboarding (Dev)
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: 0,
  },
  storeCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  storeAvatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  storeAvatarText: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#FFFFFF',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  storeUrl: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  menuContent: {
    flex: 1,
  },
  menuLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  menuLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  menuDescription: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  version: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: SPACING.lg,
    marginBottom: SPACING['3xl'],
  },
});
